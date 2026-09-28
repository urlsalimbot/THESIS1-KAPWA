export function movingAverageForecast(values: number[], horizon: number, window = 3): number[] {
  const out: number[] = [];
  const history = [...values];
  for (let h = 0; h < horizon; h++) {
    const windowValues = history.slice(-window);
    const next = windowValues.length > 0
      ? windowValues.reduce((a, b) => a + b, 0) / windowValues.length
      : 0;
    out.push(next);
    history.push(next);
  }
  return out;
}

export interface HoltResult {
  fitted: number[];
  forecast: number[];
  alpha: number;
  beta: number;
  residualStd: number;
}

function holtWithParams(values: number[], alpha: number, beta: number, horizon: number): HoltResult {
  if (values.length === 0) {
    return { fitted: [], forecast: new Array(horizon).fill(0), alpha, beta, residualStd: 0 };
  }
  let level = values[0];
  let trend = values.length > 1 ? values[1] - values[0] : 0;
  // The seed level is the first fitted value; one-step residuals exist from t=1.
  const fitted: number[] = [values[0]];
  const residuals: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prediction = level + trend;
    fitted.push(prediction);
    residuals.push(values[i] - prediction);
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const forecast: number[] = [];
  for (let h = 1; h <= horizon; h++) forecast.push(level + h * trend);
  const residualMean = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
  const variance = residuals.length > 1
    ? residuals.reduce((acc, r) => acc + (r - residualMean) ** 2, 0) / (residuals.length - 1)
    : 0;
  return { fitted, forecast, alpha, beta, residualStd: Math.sqrt(variance) };
}

export function holtLinear(
  values: number[],
  opts: { horizon?: number; alpha?: number; beta?: number; gridSearch?: boolean } = {},
): HoltResult {
  const horizon = opts.horizon ?? 6;
  if (opts.alpha != null && opts.beta != null) {
    return holtWithParams(values, opts.alpha, opts.beta, horizon);
  }
  if (values.length < 3 || opts.gridSearch === false) {
    return holtWithParams(values, opts.alpha ?? 0.5, opts.beta ?? 0.3, horizon);
  }
  let best: HoltResult | null = null;
  let bestSse = Infinity;
  for (let a = 0.05; a <= 0.9501; a += 0.05) {
    for (let b = 0.05; b <= 0.9501; b += 0.05) {
      const alpha = Number(a.toFixed(2));
      const beta = Number(b.toFixed(2));
      const result = holtWithParams(values, alpha, beta, horizon);
      const sse = result.fitted.reduce((acc, f, i) => acc + (values[i] - f) ** 2, 0);
      if (sse < bestSse) {
        bestSse = sse;
        best = result;
      }
    }
  }
  return best ?? holtWithParams(values, 0.5, 0.3, horizon);
}

export function mape(actual: number[], predicted: number[]): number | null {
  const pairs = actual
    .map((a, i) => ({ a, p: predicted[i] }))
    .filter(x => x.p != null && Number.isFinite(x.p) && Number.isFinite(x.a));
  const nonZero = pairs.filter(x => x.a !== 0);
  if (nonZero.length === 0) return null;
  return nonZero.reduce((acc, x) => acc + Math.abs((x.a - x.p) / x.a), 0) / nonZero.length;
}
