export const UNIVERSAL_DEFAULT_CATEGORIES = {
  expense: {
    label: "支出",
    options: [
      { id: "cash_purchase", label: "現結貨款", department: "", items: [] },
      { id: "operating_expense", label: "營運支出", department: "", items: ["水電瓦斯", "設備維修", "清潔用品", "廣告行銷"] },
      { id: "staff_expense", label: "人事支出", department: "", items: ["薪資", "獎金", "員工餐費", "加班費"] },
      { id: "other_expense", label: "其他支出", department: "", items: [] },
    ],
  },
  income: {
    label: "收入",
    options: [
      { id: "cash_revenue", label: "現金收入", department: "", items: ["門市現金", "外送現金", "其他現金收入"] },
      { id: "transfer_revenue", label: "轉帳收入", department: "", items: ["銀行轉帳", "LINE Pay", "信用卡"] },
      { id: "other_revenue", label: "其他收入", department: "", items: [] },
    ],
  },
};
