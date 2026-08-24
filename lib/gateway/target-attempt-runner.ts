import { shouldFailoverStatus } from './endpoint-attempt-context.ts';

export type TargetExecution<TValue, TContext> =
  | { ok: true; value: TValue }
  | { ok: false; status: number; value: TValue; context: TContext };

export interface TargetAttemptRunnerOptions<TTarget, TEndpoint, TValue, TContext> {
  targets: readonly TTarget[];
  selectEndpoint(target: TTarget): TEndpoint | undefined;
  onSelected?(target: TTarget, endpoint: TEndpoint): void | Promise<void>;
  execute(target: TTarget, endpoint: TEndpoint, failoverFrom: string | null): Promise<TargetExecution<TValue, TContext>>;
  targetLabel(target: TTarget): string;
  onUnavailable(target: TTarget, willContinue: boolean): void | Promise<void>;
  unavailableError(target: TTarget): Error;
  onFailure(
    target: TTarget,
    failure: Extract<TargetExecution<TValue, TContext>, { ok: false }>,
    willContinue: boolean,
    failoverFrom: string | null,
  ): void | Promise<void>;
}

/** One local endpoint per provider target; failover can only advance to the next provider. */
export async function runTargetAttempts<TTarget, TEndpoint, TValue, TContext>(
  options: TargetAttemptRunnerOptions<TTarget, TEndpoint, TValue, TContext>,
): Promise<TValue> {
  let failoverFrom: string | null = null;
  for (let index = 0; index < options.targets.length; index++) {
    const target = options.targets[index];
    const isLast = index === options.targets.length - 1;
    const endpoint = options.selectEndpoint(target);
    if (!endpoint) {
      await options.onUnavailable(target, !isLast);
      if (isLast) throw options.unavailableError(target);
      failoverFrom = options.targetLabel(target);
      continue;
    }

    await options.onSelected?.(target, endpoint);
    const result = await options.execute(target, endpoint, failoverFrom);
    if (result.ok) return result.value;
    const willContinue = shouldFailoverStatus(result.status) && !isLast;
    await options.onFailure(target, result, willContinue, failoverFrom);
    if (!willContinue) return result.value;
    failoverFrom = options.targetLabel(target);
  }
  throw new Error('没有可用的路由目标');
}
