"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Table as TableIcon,
  X,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TableViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  url?: string;
  data?: string;
  extractedText?: string;
  metadata?: Record<string, unknown>;
  sizeBytes?: number;
}

interface ParsedTable {
  headers: string[];
  rows: string[][];
  format: string;
  sheetName?: string;
}

export function TableViewerModal({
  isOpen,
  onClose,
  filename,
  url,
  data,
  extractedText,
  metadata,
  sizeBytes,
}: TableViewerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [fullRawText, setFullRawText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pageSize = 50;

  // If URL is provided and not binary xlsx, attempt to fetch full raw text for high-fidelity row exploration
  useEffect(() => {
    if (!isOpen) return;
    const isXlsx = filename.toLowerCase().endsWith(".xlsx");
    if (isXlsx) return; // XLSX is parsed by backend

    if (data && data.startsWith("data:text/")) {
      try {
        const parts = data.split(",", 2);
        if (parts.length === 2) {
          setFullRawText(atob(parts[1]));
          return;
        }
      } catch {
        // fallback
      }
    }

    if (url && !fullRawText) {
      setIsLoading(true);
      fetch(url)
        .then((res) => (res.ok ? res.text() : null))
        .then((text) => {
          if (text) setFullRawText(text);
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, url, data, filename, fullRawText]);

  // Parse table structure from full text or extracted Markdown
  const parsedTable: ParsedTable = useMemo(() => {
    const ext = filename.toLowerCase();

    // 1. Try raw CSV / TSV text if available
    if (fullRawText && (ext.endsWith(".csv") || ext.endsWith(".tsv") || ext.endsWith(".tab"))) {
      const delimiter = ext.endsWith(".tsv") || ext.endsWith(".tab") ? "\t" : ",";
      const lines = fullRawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const splitLine = (line: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = splitLine(lines[0]);
        const rows = lines.slice(1).map(splitLine);
        return {
          headers,
          rows,
          format: ext.endsWith(".tsv") ? "TSV" : "CSV",
        };
      }
    }

    // 2. Try JSONL from raw text
    if (fullRawText && (ext.endsWith(".jsonl") || ext.endsWith(".ndjson"))) {
      const lines = fullRawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const records: Record<string, unknown>[] = [];
      const headersSet = new Set<string>();
      for (const l of lines) {
        try {
          const obj = JSON.parse(l);
          if (typeof obj === "object" && obj !== null) {
            records.push(obj);
            Object.keys(obj).forEach((k) => headersSet.add(k));
          }
        } catch {
          // ignore malformed line
        }
      }
      const headers = Array.from(headersSet);
      const rows = records.map((r) => headers.map((h) => String(r[h] ?? "")));
      return {
        headers,
        rows,
        format: "JSONL",
      };
    }

    // 3. Fallback: Parse extracted markdown table from backend
    if (extractedText) {
      const lines = extractedText.split("\n");
      const tableLines = lines.filter((l) => l.trim().startsWith("|") && l.trim().endsWith("|"));
      if (tableLines.length >= 2) {
        const parseRow = (line: string) =>
          line
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());

        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseRow);

        let sheetName: string | undefined;
        const sheetMatch = extractedText.match(/Sheet:\s*`?([^`|\n]+)`?/);
        if (sheetMatch) sheetName = sheetMatch[1].trim();

        const formatStr = (metadata?.format as string) || (ext.endsWith(".xlsx") ? "XLSX" : "Tabular");
        return {
          headers,
          rows,
          format: formatStr.toUpperCase(),
          sheetName,
        };
      }
    }

    return {
      headers: [],
      rows: [],
      format: "Tabular",
    };
  }, [fullRawText, extractedText, filename, metadata]);

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return parsedTable.rows;
    const q = searchQuery.toLowerCase();
    return parsedTable.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(q))
    );
  }, [parsedTable.rows, searchQuery]);

  // Sort rows if sortColumn is active
  const sortedRows = useMemo(() => {
    if (sortColumn === null) return filteredRows;
    const sorted = [...filteredRows].sort((a, b) => {
      const valA = a[sortColumn] || "";
      const valB = b[sortColumn] || "";
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortAsc ? numA - numB : numB - numA;
      }
      return sortAsc
        ? valA.localeCompare(valB, undefined, { numeric: true })
        : valB.localeCompare(valA, undefined, { numeric: true });
    });
    return sorted;
  }, [filteredRows, sortColumn, sortAsc]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // Copy as CSV action
  const handleCopyCsv = () => {
    if (parsedTable.headers.length === 0) return;
    const csvContent = [
      parsedTable.headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...sortedRows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    navigator.clipboard.writeText(csvContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Download original action
  const handleDownload = () => {
    if (url) {
      const dlUrl = url.includes("?") ? `${url}&download=true` : `${url}?download=true`;
      window.open(dlUrl, "_blank");
      return;
    }
    if (data) {
      const a = document.createElement("a");
      a.href = data;
      a.download = filename;
      a.click();
    }
  };

  if (!isOpen) return null;

  const totalRowCount = (metadata?.row_count as number) || parsedTable.rows.length;
  const colCount = parsedTable.headers.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" className="max-w-6xl h-[90vh]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0 select-none bg-surface">
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="p-2 rounded-xl bg-muted border border-border text-foreground">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground truncate">
                {filename}
              </span>
              <Badge variant="secondary">
                {parsedTable.format}
              </Badge>
              {parsedTable.sheetName && (
                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
                  Sheet: {parsedTable.sheetName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground-muted font-mono mt-0.5">
              <span>{totalRowCount.toLocaleString()} rows</span>
              <span>•</span>
              <span>{colCount} columns</span>
              {sizeBytes && (
                <>
                  <span>•</span>
                  <span>{formatBytes(sizeBytes)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyCsv}
            title="Copy table data as CSV"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-success mr-1" />
                <span className="text-success font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-foreground-muted mr-1" />
                <span>Copy CSV</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleDownload}
            title="Download original file"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            <span>Download</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            title="Close modal (Esc)"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Toolbar: Search & Pagination summary */}
      <div className="px-5 py-2.5 bg-surface border-b border-border flex items-center justify-between gap-4 shrink-0 text-xs select-none">
        <div className="flex-1 max-w-sm">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Filter table rows..."
            startIcon={<Search className="w-3.5 h-3.5" />}
            inputSize="sm"
          />
        </div>

        <div className="flex items-center gap-3 text-foreground-muted text-xs">
          {searchQuery && (
            <span className="text-foreground font-medium">
              {filteredRows.length.toLocaleString()} matching rows
            </span>
          )}
          <span>
            Showing {sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, sortedRows.length)} of{" "}
            {sortedRows.length.toLocaleString()} rows
          </span>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-surface">
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="size-7 p-0 text-foreground-muted hover:text-foreground disabled:opacity-30"
              title="Previous page"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2 font-mono text-xs font-medium text-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="size-7 p-0 text-foreground-muted hover:text-foreground disabled:opacity-30"
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Spreadsheet Data Grid */}
      <div className="flex-1 overflow-auto bg-surface relative">
        {parsedTable.headers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-foreground-muted gap-2">
            <TableIcon className="w-8 h-8 stroke-1 text-foreground-subtle" />
            <p className="text-sm font-medium">No tabular data to display</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-xs border-b border-border select-none shadow-2xs">
              <tr>
                <th className="w-12 px-3 py-2.5 font-mono text-2xs text-foreground-muted font-medium border-r border-border text-center">
                  #
                </th>
                {parsedTable.headers.map((header, colIdx) => {
                  const isSorted = sortColumn === colIdx;
                  return (
                    <th
                      key={colIdx}
                      onClick={() => {
                        if (sortColumn === colIdx) {
                          if (sortAsc) setSortAsc(false);
                          else {
                            setSortColumn(null);
                            setSortAsc(true);
                          }
                        } else {
                          setSortColumn(colIdx);
                          setSortAsc(true);
                        }
                      }}
                      className="px-3.5 py-2.5 font-semibold text-foreground border-r border-border hover:bg-surface-hover transition-colors cursor-pointer whitespace-nowrap group/th"
                      title={`Click to sort by ${header}`}
                    >
                      <div className="flex items-center gap-1.5 justify-between">
                        <span className="truncate">{header}</span>
                        <span className="text-foreground-muted group-hover/th:text-foreground">
                          {isSorted ? (
                            sortAsc ? (
                              <ArrowUp className="w-3.5 h-3.5 text-foreground" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-foreground" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                          )}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-sans bg-surface">
              {paginatedRows.map((row, rowIdx) => {
                const globalRowIdx = (currentPage - 1) * pageSize + rowIdx + 1;
                return (
                  <tr
                    key={rowIdx}
                    className="hover:bg-surface-hover transition-colors group/row"
                  >
                    <td className="px-3 py-2 font-mono text-2xs text-foreground-muted border-r border-border text-center bg-background-secondary/40 select-none">
                      {globalRowIdx}
                    </td>
                    {parsedTable.headers.map((_, colIdx) => {
                      const cellVal = row[colIdx] || "";
                      return (
                        <td
                          key={colIdx}
                          className="px-3.5 py-2 text-foreground border-r border-border max-w-xs truncate select-text"
                          title={cellVal}
                        >
                          {cellVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer status bar */}
      <div className="px-5 py-2 border-t border-border bg-background-secondary flex items-center justify-between text-xs text-foreground-muted shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span>GraphMind Tabular Engine</span>
          <span>•</span>
          <span>Click any column header to sort</span>
        </div>
        {isLoading && (
          <span className="text-foreground-muted animate-pulse">Streaming raw rows...</span>
        )}
      </div>
    </Modal>
  );
}
