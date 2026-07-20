import { Loader2, Users } from 'lucide-react';
import { FamilyTreeGraph } from './FamilyTreeGraph';

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
  loading: boolean;
  error: string | null;
  members: FamilyMemberNode[];
  primary: FamilyMemberNode | null;
}

export function FamilyGraph({ loading, error, members, primary }: FamilyGraphProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 size={20} className="mr-2 animate-spin" />
        <span className="text-sm">Loading family data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-destructive/10 py-8 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Users size={20} className="mr-2" />
        No family members found
      </div>
    );
  }

  return <FamilyTreeGraph members={members} primary={primary} />;
}
