import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ConversationTree } from "@graphmind/shared";
import { GraphCanvas } from "../GraphCanvas";
import { Button } from "@/components/ui/button";
import userEvent from "@testing-library/user-event";
import { ConversationCanvasCard } from "../ThreadGraphNode";

const camera = vi.hoisted(() => ({fitView:vi.fn(),zoomIn:vi.fn(),zoomOut:vi.fn(),setViewport:vi.fn(),
  setCenter:vi.fn(),getZoom:() => 0.9,getNodes:() => [],zoomTo:vi.fn()}));

vi.mock("@/lib/canvasApi", () => ({
  readCanvasLayout: vi.fn(async () => ({ layout: null, revision: 0 })),
  writeCanvasLayout: vi.fn(async (_w, _c, _k, revision, layout) => ({ layout, revision: revision + 1 })),
}));

vi.mock("@/lib/workspaceApi", () => ({
  getWorkspaceMastery: vi.fn(async () => null),
  getWorkspaceTimeline: vi.fn(async () => ({workspaceId:"w",totalEvents:2,milestones:[],events:[
    {id:"1",timestamp:"2026-10-01T00:00:00Z",eventType:"node_created",title:"Start",entityId:"r",isMilestone:false},
    {id:"2",timestamp:"2026-10-05T00:00:00Z",eventType:"branch_created",title:"Branch",entityId:"x",isMilestone:true},
  ]})),
}));

vi.mock("@xyflow/react", async () => {
  const real = await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
  return { ...real,
    ReactFlowProvider: ({ children }: {children: React.ReactNode}) => children,
    useViewport: () => ({ x: 0, y: 0, zoom: 0.9 }),
    useNodesInitialized: () => true,
    useReactFlow: () => camera,
    Handle: () => null,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => <div data-testid="minimap" />,
    ReactFlow: ({nodes, nodeTypes, edges, children, onNodeDragStop}: {nodes: Array<{id: string; data: unknown; position:{x:number;y:number};type:string}>;
      edges:Array<{id:string;sourceHandle?:string;targetHandle?:string}>;
      nodeTypes: Record<string, React.ComponentType<{data: unknown}>>; children: React.ReactNode;
      onNodeDragStop?: (event:null,node:unknown) => void}) => (
      <div>{nodes.map(node => { const Component = nodeTypes[node.type]; return (
        <div key={node.id} data-testid={node.id} data-position={JSON.stringify(node.position)}><Component data={node.data} /></div>
      ); })}{edges.map(edge => <span key={edge.id} data-testid={`edge:${edge.id}`} data-source-handle={edge.sourceHandle ?? ""} data-target-handle={edge.targetHandle ?? ""} />)}
      <Button aria-label="Move first card" onClick={() => onNodeDragStop?.(null,{...nodes[0],position:{x:600,y:900}})}>Move</Button>
      <Button aria-label="Move branch card" onClick={() => onNodeDragStop?.(null,{...nodes.find(n=>n.id==='segment:x'),position:{x:600,y:900}})}>Move branch</Button>{children}</div>),
  };
});

const tree: ConversationTree = { id: "w", rootNodeId: "r", activeNodeId: "b", createdAt: "", updatedAt: "", nodes: {
  r: {id:"r",parentId:null,childrenIds:["a"],role:"user",content:"Question",createdAt:""},
  a: {id:"a",parentId:"r",childrenIds:["b","x"],role:"assistant",content:"Answer",createdAt:""},
  b: {id:"b",parentId:"a",childrenIds:[],role:"user",content:"Follow-up",createdAt:""},
  x: {id:"x",parentId:"a",childrenIds:[],role:"user",content:"Branch question",highlightedContext:"Detailed branch",createdAt:""},
} };

describe("shared conversation canvas", () => {
  it("keeps advanced controls hidden and selects the actual branch message", () => {
    const onSelect = vi.fn();
    render(<GraphCanvas tree={tree} onSelectNode={onSelect} />);
    expect(screen.queryByTestId("minimap")).not.toBeInTheDocument();
    expect(screen.queryByText(/Galaxy/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name:"Detailed branch"}));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("x");
    expect(screen.getByRole("button", {name:"Canvas options"})).toBeVisible();
    expect(screen.getByTestId("edge:segment:r->segment:x")).toHaveAttribute("data-source-handle", "branch");
    expect(screen.getByTestId("edge:segment:r->segment:x")).toHaveAttribute("data-target-handle", "branch");
  });

  it("does not move segments when selecting a branch or streaming content", () => {
    const props = {tree, onSelectNode:vi.fn()};
    const {rerender} = render(<GraphCanvas {...props} />);
    fireEvent.click(screen.getByRole("button", {name:"Move first card"}));
    const before = screen.getByTestId("segment:r").getAttribute("data-position");
    expect(before).toBe('{"x":600,"y":900}');
    const changed = {...tree,activeNodeId:"x",nodes:{...tree.nodes,x:{...tree.nodes.x,content:"More streamed text"}}};
    rerender(<GraphCanvas {...props} tree={changed} isStreaming isSidePeekOpen />);
    expect(screen.getByTestId("segment:r")).toHaveAttribute("data-position",before);
  });

  it("fits on first measurement and exposes working fit/zoom controls", async () => {
    camera.fitView.mockClear();
    camera.zoomIn.mockClear();
    const fitRef = {current:null as (() => void)|null};
    render(<GraphCanvas tree={tree} onSelectNode={vi.fn()} onFitViewRef={fitRef} />);
    await waitFor(() => expect(camera.fitView).toHaveBeenCalled());
    expect(fitRef.current).not.toBeNull();
    fireEvent.click(screen.getByRole("button", {name:"Zoom in"}));
    expect(camera.zoomIn).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", {name:"Fit canvas"}));
    expect(camera.fitView.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("restores manual branch positions after read-only timeline replay", async () => {
    const historyTree = {...tree,nodes:{...tree.nodes,
      r:{...tree.nodes.r,createdAt:"2026-10-01T00:00:00Z"},a:{...tree.nodes.a,createdAt:"2026-10-01T00:00:00Z"},
      b:{...tree.nodes.b,createdAt:"2026-10-02T00:00:00Z"},x:{...tree.nodes.x,createdAt:"2026-10-03T00:00:00Z"}}};
    camera.fitView.mockClear();
    render(<GraphCanvas tree={historyTree} workspaceId="w" onSelectNode={vi.fn()} />);
    await waitFor(() => expect(camera.fitView).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button",{name:"Move branch card"}));
    expect(screen.getByTestId("segment:x")).toHaveAttribute("data-position",'{"x":600,"y":900}');
    await userEvent.click(screen.getByRole("button",{name:"Canvas options"}));
    await userEvent.click(screen.getByRole("menuitem",{name:"Open timeline"}));
    await waitFor(() => expect(screen.getByRole("button",{name:"Jump to Start"})).toBeVisible());
    fireEvent.click(screen.getByRole("button",{name:"Jump to Start"}));
    await waitFor(() => expect(screen.queryByTestId("segment:x")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button",{name:"Exit Timeline Replay"}));
    await waitFor(() => expect(screen.getByTestId("segment:x")).toHaveAttribute("data-position",'{"x":600,"y":900}'));
  });

  it("confirms deletion using the original thread root and supports cancel", async () => {
    const onDelete=vi.fn();
    render(<ConversationCanvasCard item={{id:"segment:last",kind:"conversation",title:"A branch",itemIds:["last"],
      selectionId:"last",threadId:"original-root",lane:"side",parentId:"main",originId:"a",order:0}}
      selected={false} streaming={false} onSelect={vi.fn()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button",{name:"Actions for A branch"}));
    await userEvent.click(screen.getByRole("menuitem",{name:"Delete branch"}));
    expect(screen.getByRole("alertdialog",{name:"Delete branch?"})).toBeVisible();
    await userEvent.click(screen.getByRole("button",{name:"Cancel"}));
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button",{name:"Actions for A branch"}));
    await userEvent.click(screen.getByRole("menuitem",{name:"Delete branch"}));
    await userEvent.click(screen.getByRole("button",{name:"Delete branch"}));
    expect(onDelete).toHaveBeenCalledWith("original-root");
  });
});
