export type BodyDownloadObservation =
  | { state: 'exact' | 'different' | 'not_checked' }
  | { state: 'error'; reason: 'http_error' | 'read_error'; status?: number };

export interface CaptureCandidateObservation {
  id: string;
  complete: boolean;
  status: number | null;
  stream: boolean;
  request: BodyDownloadObservation;
  response: BodyDownloadObservation;
}

export interface CaptureMatchExpectation {
  status: number;
  stream: boolean;
  requireResponse: boolean;
}

export interface CaptureMatchEvaluation {
  ready: boolean;
  exactRequestIds: string[];
  diagnostic: string;
}

function describeDownload(observation: BodyDownloadObservation): string {
  if (observation.state !== 'error') return observation.state;
  return observation.status === undefined
    ? `error:${observation.reason}`
    : `error:${observation.reason}:${observation.status}`;
}

export function evaluateExactOnceCapture(
  candidates: readonly CaptureCandidateObservation[],
  expected: CaptureMatchExpectation,
): CaptureMatchEvaluation {
  const exactRequestCandidates = candidates.filter((candidate) => candidate.request.state === 'exact');
  const requestFailures = candidates.filter((candidate) => candidate.request.state === 'error');
  const readyCandidates = exactRequestCandidates.filter((candidate) => (
    candidate.complete
    && candidate.status === expected.status
    && candidate.stream === expected.stream
    && (!expected.requireResponse || candidate.response.state === 'exact')
  ));
  const diagnostic = candidates.length === 0
    ? 'candidates=[] exact_request_ids=[]'
    : `candidates=[${candidates.map((candidate) => (
      `id=${candidate.id} complete=${candidate.complete} status=${candidate.status ?? 'null'} `
      + `stream=${candidate.stream} request=${describeDownload(candidate.request)} `
      + `response=${describeDownload(candidate.response)}`
    )).join('; ')}] exact_request_ids=[${exactRequestCandidates.map((candidate) => candidate.id).join(',')}]`;
  return {
    ready: requestFailures.length === 0
      && exactRequestCandidates.length === 1
      && readyCandidates.length === 1,
    exactRequestIds: exactRequestCandidates.map((candidate) => candidate.id),
    diagnostic,
  };
}
