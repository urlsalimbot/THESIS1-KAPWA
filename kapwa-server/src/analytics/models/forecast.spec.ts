import { movingAverageForecast, holtLinear, mape } from './forecast';

describe('forecast models', () => {
  it('continues a perfect linear series', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = holtLinear(values, { horizon: 3 });
    expect(result.forecast).toHaveLength(3);
    expect(result.forecast[0]).toBeCloseTo(11, 6);
    expect(result.forecast[2]).toBeCloseTo(13, 6);
    expect(result.fitted[9]).toBeCloseTo(10, 6);
    expect(result.residualStd).toBeCloseTo(0, 6);
  });

  it('fits a noiseless linear series exactly from the second point', () => {
    const result = holtLinear([2, 4, 6, 8], { horizon: 1, alpha: 0.5, beta: 0.5 });
    expect(result.fitted[0]).toBe(2);
    expect(result.fitted[1]).toBeCloseTo(4, 6);
    expect(result.residualStd).toBeCloseTo(0, 6);
    expect(result.forecast[0]).toBeCloseTo(10, 6);
  });

  it('reports zero MAPE for exact predictions and null when nothing is comparable', () => {
    expect(mape([1, 2, 3], [1, 2, 3])).toBeCloseTo(0);
    expect(mape([], [])).toBeNull();
    expect(mape([0, 0], [1, 1])).toBeNull();
  });

  it('handles short and all-zero series without NaN', () => {
    const short = holtLinear([5], { horizon: 2 });
    expect(short.forecast.every(v => Number.isFinite(v))).toBe(true);
    const zeros = holtLinear([0, 0, 0, 0], { horizon: 4 });
    expect(zeros.forecast).toEqual([0, 0, 0, 0]);
    expect(Number.isFinite(zeros.residualStd)).toBe(true);
  });

  it('forecasts a moving average for a flat series and reacts to a jump', () => {
    expect(movingAverageForecast([5, 5, 5], 2)).toEqual([5, 5]);
    const ma = movingAverageForecast([0, 0, 9], 1);
    expect(ma[0]).toBeCloseTo(3);
  });

  it('grid-searches alpha and beta within the documented bounds', () => {
    const result = holtLinear([1, 2, 3, 4, 5, 6]);
    expect(result.alpha).toBeGreaterThanOrEqual(0.05);
    expect(result.alpha).toBeLessThanOrEqual(0.95);
    expect(result.beta).toBeGreaterThanOrEqual(0.05);
    expect(result.beta).toBeLessThanOrEqual(0.95);
  });
});
