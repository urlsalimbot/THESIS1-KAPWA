import { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  NodeProps,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  computeFamilyTreeLayout,
  NODE_WIDTH,
  type FamilyFlowNode,
  type FamilyFlowEdge,
  type FamilyMemberNode,
} from './family-tree-layout';

// Re-exported so callers keep importing the member shape from this component.
export type { FamilyMemberNode } from './family-tree-layout';

interface FamilyTreeGraphProps {
  members: FamilyMemberNode[];
  primary: FamilyMemberNode | null;
}

function FamilyMemberNode({ data }: NodeProps<FamilyFlowNode>) {
  const { t } = useTranslation();
  const member = data as FamilyMemberNode;
  const initial = (member.fullName || '?').charAt(0).toUpperCase();
  return (
    <div
      className={`
        flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md
        ${member.isPrimary ? 'border-primary ring-1 ring-primary/20' : 'border-border'}
      `}
      style={{ width: NODE_WIDTH }}
    >
      <div
        className={`
          flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold
          ${member.isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
        `}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{member.fullName}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {member.relationship} &middot; {member.age} {t('family.yrs', 'yrs')}
        </p>
        {member.statusIncome && (
          <p className="truncate text-[9px] text-muted-foreground">{member.statusIncome}</p>
        )}
      </div>
      {/* Descent lines leave the bottom and arrive at the top; a marriage or a
          sibling bond runs sideways between the left and right handles. */}
      <Handle type="target" position={Position.Top} className="!border-border !bg-background" />
      <Handle type="source" position={Position.Bottom} className="!border-border !bg-background" />
      <Handle id="left" type="target" position={Position.Left} className="!border-border !bg-background" />
      <Handle id="right" type="source" position={Position.Right} className="!border-border !bg-background" />
    </div>
  );
}

/** Quiet caption in the gutter beside each generation. */
function LayerLabel({ data }: NodeProps<FamilyFlowNode>) {
  const { t } = useTranslation();
  const layerKey = (data as { layerKey?: string }).layerKey ?? '';
  const caption = t(`family.layer.${layerKey}`, {
    grandparents: 'Grandparents',
    parents: 'Parents',
    household: 'This household',
    children: 'Children',
    grandchildren: 'Grandchildren',
  }[layerKey] ?? '');
  return (
    <div className="pointer-events-none select-none whitespace-nowrap text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {caption}
    </div>
  );
}

const nodeTypes = { familyMember: FamilyMemberNode, layerLabel: LayerLabel };

export function FamilyTreeGraph({ members, primary }: FamilyTreeGraphProps) {
  const { t } = useTranslation();
  const layout = useMemo(() => computeFamilyTreeLayout(members, primary), [members, primary]);
  const [nodes, setNodes, onNodesChange] = useNodesState<FamilyFlowNode>(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FamilyFlowEdge>(layout.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onNodeClick = useCallback((_: React.MouseEvent, node: FamilyFlowNode) => {
    if (node.type === 'layerLabel') return;
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
                  {selectedMember.isPrimary && <span className="ml-1.5 text-[10px] text-primary font-medium">({t('family.primary', 'Primary')})</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedMember.relationship} &middot; {selectedMember.age} {t('family.yrs', 'yrs')}
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
