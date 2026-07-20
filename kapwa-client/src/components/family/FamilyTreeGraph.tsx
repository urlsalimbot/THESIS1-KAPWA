import { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  NodeProps,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { User } from 'lucide-react';

interface FamilyMemberNode {
  id: string;
  fullName: string;
  relationship: string;
  age: number;
  statusIncome?: string;
  isPrimary: boolean;
  depth: number;
}

interface FamilyTreeGraphProps {
  members: FamilyMemberNode[];
  primary: FamilyMemberNode | null;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;
const LAYER_GAP_Y = 100;
const NODE_GAP_X = 24;

function computeLayout(members: FamilyMemberNode[], primary: FamilyMemberNode | null) {
  const all = primary ? [primary, ...members.filter(m => m.id !== primary.id)] : [...members];
  const byDepth: Record<number, FamilyMemberNode[]> = {};
  all.forEach(m => {
    if (!byDepth[m.depth]) byDepth[m.depth] = [];
    byDepth[m.depth].push(m);
  });
  const depths = Object.keys(byDepth).map(Number).sort();
  const nodes: any[] = [];
  const edges: any[] = [];

  depths.forEach((depth) => {
    const layer = byDepth[depth];
    const totalWidth = (layer.length - 1) * (NODE_WIDTH + NODE_GAP_X);
    const startX = -totalWidth / 2;
    layer.forEach((m, i) => {
      nodes.push({
        id: m.id,
        type: 'familyMember',
        position: { x: startX + i * (NODE_WIDTH + NODE_GAP_X), y: depth * (NODE_HEIGHT + LAYER_GAP_Y) },
        data: m,
      });
    });
  });

  if (primary) {
    all.forEach(m => {
      if (m.id !== primary.id) {
        edges.push({
          id: `e-${primary.id}-${m.id}`,
          source: primary.id,
          target: m.id,
          label: m.relationship,
          type: 'smoothstep',
          animated: m.depth <= 1,
          style: { stroke: '#3D5A80', strokeWidth: 1.5 },
          labelStyle: { fill: '#5C5A56', fontSize: 10, fontWeight: 500 },
          labelBgStyle: { fill: '#FFFFFF', fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
        });
      }
    });
  }

  return { nodes, edges };
}

const edgeTypeColors: Record<string, string> = {
  Spouse: '#C8553D',
  Child: '#3D5A80',
  Parent: '#1B3A5C',
  Sibling: '#5C5A56',
};

const edgeTypeLabels: Record<string, string> = {
  Spouse: 'Spouse',
  Child: 'Child',
  Parent: 'Parent',
  Sibling: 'Sibling',
  Grandparent: 'Grandparent',
  Grandchild: 'Grandchild',
  Other: 'Relative',
};

function FamilyMemberNode({ data }: NodeProps<FamilyMemberNode>) {
  const initial = data.fullName.charAt(0).toUpperCase();
  return (
    <div
      className={`
        flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md
        ${data.isPrimary ? 'border-primary ring-1 ring-primary/20' : 'border-border'}
      `}
      style={{ width: NODE_WIDTH }}
    >
      <div
        className={`
          flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold
          ${data.isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
        `}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{data.fullName}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {data.relationship} &middot; {data.age} yrs
        </p>
        {data.statusIncome && (
          <p className="truncate text-[9px] text-muted-foreground">{data.statusIncome}</p>
        )}
      </div>
      <Handle type="target" position={Position.Top} className="!border-border !bg-background" />
      <Handle type="source" position={Position.Bottom} className="!border-border !bg-background" />
    </div>
  );
}

const nodeTypes = { familyMember: FamilyMemberNode };

export function FamilyTreeGraph({ members, primary }: FamilyTreeGraphProps) {
  const layout = useMemo(() => computeLayout(members, primary), [members, primary]);
  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedId(prev => prev === node.id ? null : node.id);
  }, []);

  const selectedMember = useMemo(() => {
    if (!selectedId) return null;
    return members.find(m => m.id === selectedId) || primary;
  }, [selectedId, members, primary]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-border bg-background/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable
          nodesConnectable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          minZoom={0.3}
          maxZoom={2.5}
          panOnDrag
          zoomOnScroll
          selectNodesOnDrag={false}
          defaultEdgeOptions={{ zIndex: 0 }}
        >
          <Background color="#D8D4CE" gap={20} size={1} />
          <Controls
            showInteractive={false}
            className="!bg-card !border-border [&_button]:!border-border [&_button]:!text-muted-foreground [&_button:hover]:!bg-muted [&_svg]:!fill-muted-foreground"
          />
          <MiniMap
            nodeStrokeColor="#D8D4CE"
            nodeColor="#E5E2DD"
            nodeBorderRadius={4}
            maskColor="rgba(0,0,0,0.08)"
            className="!border-border !shadow-sm"
          />
        </ReactFlow>
      </div>

      {selectedMember && (
        <div className="rounded-lg border border-border bg-card p-3 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${selectedMember.isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {selectedMember.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {selectedMember.fullName}
                  {selectedMember.isPrimary && <span className="ml-1.5 text-[10px] text-primary font-medium">(Primary)</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedMember.relationship} &middot; {selectedMember.age} yrs
                </p>
              </div>
            </div>
            {selectedMember.statusIncome && (
              <span className="text-[11px] text-muted-foreground">{selectedMember.statusIncome}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
