export type OverseasTargetStatus =
  | 'candidate'
  | 'selected'
  | 'settlerRequested'
  | 'transportRequested'
  | 'expeditionPreparing'
  | 'expeditionReady'
  | 'staging'
  | 'readyToBoard'
  | 'embarked'
  | 'enRoute'
  | 'landing'
  | 'readyToEmbark'
  | 'completed'
  | 'cancelled';

export type OverseasTargetSource = 'marker' | 'settlementTargetMetadata' | 'resource';

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
  requestedTransportUnitTypeId?: string;
  /** Settler whose Cargo Ship landing earned one local follow-up build. */
  localFollowUpSettlerUnitId?: string;
  /** Persisted one-shot guard; true after the follow-up was queued or rejected. */
  localFollowUpSettlerHandled?: boolean;
  /**
   * Overseas route-recovery runtime state (in-memory; safe to be absent after
   * load). Tracks progress of the naval transit toward the objective so a stalled
   * expedition can reroute instead of freezing indefinitely.
   */
  stallBestDistance?: number;
  stallTurns?: number;
  /** Active intermediate recovery waypoint the transport is routing to, if any. */
  recoveryWaypointX?: number;
  recoveryWaypointY?: number;
  /**
   * Chosen origin embarkation coast (land tile on the Settler's own reachable
   * landmass whose adjacent water the Transport can also reach). Transient runtime
   * state; safe to be absent after load — it is recomputed on demand.
   */
  embarkCoastX?: number;
  embarkCoastY?: number;
}
