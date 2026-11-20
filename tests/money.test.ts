// money.ts 的核对用例：docs/03 第 10.3 节，一行一个测试，数字照抄
import { describe, expect, it } from "vitest";
import { applyBp, fenToSen, formatRM, formatYuan, rmToSen, senToFen, yuanToFen } from "../src/engine/money";

describe("money.ts 核对用例（docs/03 第 10.3 节）", () => {
  it("[G03-10.3#01] applyBp(2000, 1458) = 292", () => {
    expect(applyBp(2000, 1458)).toBe(292);
  });
  it("[G03-10.3#02] applyBp(2290, 378) = 87", () => {
    expect(applyBp(2290, 378)).toBe(87);
  });
  it("[G03-10.3#03] applyBp(690, 910) = 63", () => {
    expect(applyBp(690, 910)).toBe(63);
  });
  it("[G03-10.3#04] applyBp(50, 100) = 1（正好一半时进位）", () => {
    expect(applyBp(50, 100)).toBe(1);
  });
  it("[G03-10.3#05] senToFen(1277, 16500) = 2107", () => {
    expect(senToFen(1277, 16500)).toBe(2107);
  });
  it("[G03-10.3#06] senToFen(333, 16500) = 549", () => {
    expect(senToFen(333, 16500)).toBe(549);
  });
  it("[G03-10.3#07] senToFen(1, 16500) = 2", () => {
    expect(senToFen(1, 16500)).toBe(2);
  });
  it("[G03-10.3#08] senToFen(0, 16500) = 0", () => {
    expect(senToFen(0, 16500)).toBe(0);
  });
  it("[G03-10.3#09] senToFen(-1265, 16500) = -2087", () => {
    expect(senToFen(-1265, 16500)).toBe(-2087);
  });
  it("[G03-10.3#10] fenToSen(500000, 16500) = 303030", () => {
    expect(fenToSen(500000, 16500)).toBe(303030);
  });
  it("[G03-10.3#11] rmToSen(6.9) = 690", () => {
    expect(rmToSen(6.9)).toBe(690);
  });
  it("[G03-10.3#12] yuanToFen(12.34) = 1234", () => {
    expect(yuanToFen(12.34)).toBe(1234);
  });
  it('[G03-10.3#13] formatRM(1277) = "RM 12.77"', () => {
    expect(formatRM(1277)).toBe("RM 12.77");
  });
  it('[G03-10.3#14] formatRM(303030) = "RM 3,030.30"', () => {
    expect(formatRM(303030)).toBe("RM 3,030.30");
  });
  it('[G03-10.3#15] formatRM(-1265) = "-RM 12.65"', () => {
    expect(formatRM(-1265)).toBe("-RM 12.65");
  });
  it('[G03-10.3#16] formatYuan(123456) = "¥1,234.56"', () => {
    expect(formatYuan(123456)).toBe("¥1,234.56");
  });
  it('[G03-10.3#17] formatYuan(-2087) = "-¥20.87"', () => {
    expect(formatYuan(-2087)).toBe("-¥20.87");
  });
});

describe("money.ts 其他情况", () => {
  it("fenToSen 负数时加回负号", () => {
    expect(fenToSen(-500000, 16500)).toBe(-303030);
  });
  it("formatRM 和 formatYuan 显示 0 和不足一元的金额", () => {
    expect(formatRM(0)).toBe("RM 0.00");
    expect(formatYuan(5)).toBe("¥0.05");
    expect(formatYuan(100000000)).toBe("¥1,000,000.00");
  });
});
