export type OverseasTargetStatus =
  | 'candidate'
  | 'selected'
  | 'settlerRequested'
  | 'transportRequested'
  | 'expeditionPreparing'
  | 'expeditionReady'
  | 'staging'
  | 'readyToBoard'
  | 'readyToEmbark'
  | 'completed'
  | 'cancelled';

export type OverseasTargetSource = 'marker' | 'settlementTargetMetadata';

export interface OverseasSettlementTarget {
  markerId: string;
  name: string;
  targetX: number;
  targetY: number;
  source?: OverseasTargetSource;
  priority: number;
  discoveredTurn: number;
  selected: boolean;
  status: OverseasTargetStatus;
  assignedSettlerUnitId?: string;
  assignedTransportUnitId?: string;
  settlerRequested?: boolean;
  transportRequested?: boolean;
}
