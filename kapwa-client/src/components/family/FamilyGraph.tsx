import { useState, useEffect } from 'react';
import { User, Loader2, Users, AlertCircle } from 'lucide-react';
import { getFamilyGraph } from '../../lib/api';

interface FamilyMemberNode {
  id: string;
  fullName: string;
  relationship: string;
  age: number;
  statusIncome?: string;
  isPrimary: boolean;
  depth: number;
}

interface FamilyGraphProps {
  beneficiaryId: string;
}

function DepthBadge({ depth }: { depth: number }) {
  const labels = ['Direct Household', '1st Degree', '2nd Degree'];
  const label = labels[depth] || `${depth}th Degree`;
  return (
    <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      {label}
    </span>
  );
}

export function FamilyGraph({ beneficiaryId }: FamilyGraphProps) {
  const [members, setMembers] = useState<FamilyMemberNode[]>([]);
  const [primary, setPrimary] = useState<FamilyMemberNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getFamilyGraph(beneficiaryId)
      .then((data: any) => {
        if (cancelled) return;
        setMembers(data.members || []);
        setPrimary(data.primary || null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError('Unable to load family data — check consent status');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [beneficiaryId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span>Loading family data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-red-50 py-8 text-sm text-red-600">
        <AlertCircle className="mr-2 h-5 w-5" />
        {error}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        <Users className="mr-2 h-5 w-5" />
        No family members found
      </div>
    );
  }

  // Group members by depth
  const byDepth: Record<number, FamilyMemberNode[]> = {};
  members.forEach(m => {
    if (!byDepth[m.depth]) byDepth[m.depth] = [];
    byDepth[m.depth].push(m);
  });
  const depths = Object.keys(byDepth).map(Number).sort();

  return (
    <div className="space-y-4">
      {/* Primary beneficiary card */}
      {primary && (
        <div className="rounded-lg border border-[#2E5C8A]/20 bg-[#2E5C8A]/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2E5C8A] text-white">
              <User size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{primary.fullName}</p>
              <p className="text-xs text-gray-500">
                {primary.relationship} · {primary.age} yrs
                {primary.isPrimary && <span className="ml-2 text-[#2E5C8A]">(Primary)</span>}
              </p>
              {primary.statusIncome && (
                <p className="text-xs text-gray-400">{primary.statusIncome}</p>
              )}
            </div>
            <DepthBadge depth={primary.depth} />
          </div>
        </div>
      )}

      {/* Members by depth */}
      {depths.map(depth => (
        <div key={depth}>
          {depth > 0 && (
            <p className="mb-2 text-xs font-medium text-gray-500">
              {depth === 1 ? '1st Degree' : '2nd Degree'} Relatives
            </p>
          )}
          <div className="space-y-2">
            {byDepth[depth]
              .filter(m => !primary || m.id !== primary.id)
              .map(member => (
                <div
                  key={member.id}
                  className={`rounded-lg border p-3 ${
                    depth === 0
                      ? 'border-gray-200 bg-gray-50'
                      : depth === 1
                      ? 'ml-4 border-gray-200 bg-white'
                      : 'ml-8 border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                        {member.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{member.fullName}</p>
                        <p className="text-xs text-gray-500">
                          {member.relationship} · {member.age} yrs
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.statusIncome && (
                        <span className="text-xs text-gray-400">{member.statusIncome}</span>
                      )}
                      <DepthBadge depth={member.depth} />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
