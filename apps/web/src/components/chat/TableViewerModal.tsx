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

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

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

  // Listen for Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
        // Simple CSV splitter handling quoted cells
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
        // line 1 is separator | --- | --- |
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
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in-50 duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl border border-zinc-200/90 flex flex-col overflow-hidden animate-in zoom-in-98 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between shrink-0 select-none bg-zinc-50/80">
          <div className="flex items-center space-x-3 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm text-zinc-950 truncate">
                  {filename}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300/80">
                  {parsedTable.format}
                </span>
                {parsedTable.sheetName && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/80">
                    Sheet: {parsedTable.sheetName}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-zinc-500 font-mono mt-0.5">
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
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyCsv}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium shadow-2xs transition-all cursor-pointer"
              title="Copy table data as CSV"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Copy CSV</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-2xs transition-colors cursor-pointer"
              title="Download original file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer ml-1"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Pagination summary */}
        <div className="px-5 py-2.5 bg-white border-b border-zinc-100 flex items-center justify-between gap-4 shrink-0 text-xs select-none">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter table rows..."
              className="w-full pl-8.5 pr-3 py-1.5 bg-zinc-50 border border-zinc-200/90 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center space-x-3 text-zinc-500 text-xs">
            {searchQuery && (
              <span className="text-zinc-600 font-medium">
                {filteredRows.length.toLocaleString()} matching rows
              </span>
            )}
            <span>
              Showing {sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, sortedRows.length)} of{" "}
              {sortedRows.length.toLocaleString()} rows
            </span>

            {/* Pagination Controls */}
            <div className="flex items-center space-x-1 border border-zinc-200 rounded-lg p-0.5 bg-zinc-50">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded text-zinc-600 hover:text-zinc-950 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-[11px] font-medium text-zinc-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded text-zinc-600 hover:text-zinc-950 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Spreadsheet Data Grid */}
        <div className="flex-1 overflow-auto bg-zinc-50/50 relative">
          {parsedTable.headers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2">
              <TableIcon className="w-8 h-8 stroke-1 text-zinc-300" />
              <p className="text-sm font-medium">No tabular data to display</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-100/95 backdrop-blur-xs border-b border-zinc-200/90 select-none shadow-2xs">
                <tr>
                  <th className="w-12 px-3 py-2.5 font-mono text-[11px] text-zinc-400 font-medium border-r border-zinc-200/70 text-center">
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
                        className="px-3.5 py-2.5 font-semibold text-zinc-800 border-r border-zinc-200/70 hover:bg-zinc-200/60 transition-colors cursor-pointer whitespace-nowrap group/th"
                        title={`Click to sort by ${header}`}
                      >
                        <div className="flex items-center space-x-1.5 justify-between">
                          <span className="truncate">{header}</span>
                          <span className="text-zinc-400 group-hover/th:text-zinc-700">
                            {isSorted ? (
                              sortAsc ? (
                                <ArrowUp className="w-3.5 h-3.5 text-zinc-900" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-zinc-900" />
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
              <tbody className="divide-y divide-zinc-200/60 font-sans bg-white">
                {paginatedRows.map((row, rowIdx) => {
                  const globalRowIdx = (currentPage - 1) * pageSize + rowIdx + 1;
                  return (
                    <tr
                      key={rowIdx}
                      className="hover:bg-zinc-50/80 transition-colors group/row"
                    >
                      <td className="px-3 py-2 font-mono text-[10px] text-zinc-400 border-r border-zinc-100 text-center bg-zinc-50/40 select-none">
                        {globalRowIdx}
                      </td>
                      {parsedTable.headers.map((_, colIdx) => {
                        const cellVal = row[colIdx] || "";
                        return (
                          <td
                            key={colIdx}
                            className="px-3.5 py-2 text-zinc-700 border-r border-zinc-100 max-w-xs truncate select-text"
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
        <div className="px-5 py-2 border-t border-zinc-100 bg-zinc-50/80 flex items-center justify-between text-[11px] text-zinc-500 shrink-0 select-none">
          <div className="flex items-center space-x-2">
            <span>GraphMind Tabular Engine</span>
            <span>•</span>
            <span>Click any column header to sort</span>
          </div>
          {isLoading && (
            <span className="text-zinc-400 animate-pulse">Streaming raw rows...</span>
          )}
        </div>
      </div>
    </div>
  );
}
