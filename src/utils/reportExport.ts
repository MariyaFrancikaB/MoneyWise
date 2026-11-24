import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import type {
  Budget,
  ExpenseEntry,
  IncomeEntry,
  Loan,
  SavingsGoal,
} from '../types/finance';
import { formatDateShort, type FinancialSummary } from './formatters';

export function exportReportToPDF(params: {
  periodLabel: string;
  userName: string;
  summary: FinancialSummary;
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
  goals: SavingsGoal[];
  loans: Loan[];
}) {
  const { periodLabel, userName, summary, expenses, goals, loans } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 48;

  const addLine = (text: string, size = 10, bold = false, color: [number, number, number] = [30, 30, 45]) => {
    if (y > 760) {
      doc.addPage();
      y = 48;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(text, 44, y);
    y += size + 8;
  };

  doc.setFillColor(18, 12, 36);
  doc.rect(0, 0, 595, 86, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('MoneyWise Financial Report', 44, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(196, 181, 253);
  doc.text(`${periodLabel}  |  Prepared for ${userName}  |  Currency: INR (Rs.)`, 44, 62);

  y = 116;
  addLine('Executive Summary', 14, true, [91, 33, 182]);
  addLine(`Monthly Salary: Rs. ${Math.round(summary.monthlySalary).toLocaleString('en-IN')}`);
  addLine(`Additional Income: Rs. ${Math.round(summary.additionalIncome).toLocaleString('en-IN')}`);
  addLine(`Total Income: Rs. ${Math.round(summary.totalIncome).toLocaleString('en-IN')}`, 11, true);
  addLine(`Total Expenses: Rs. ${Math.round(summary.totalExpenses).toLocaleString('en-IN')}`, 11, true);
  addLine(`Total Savings / Net Balance: Rs. ${Math.round(summary.totalSavings).toLocaleString('en-IN')}`, 11, true);
  addLine(`Savings Percentage: ${summary.savingsPercentage.toFixed(2)}%`);
  addLine(
    `Fixed vs Variable Spend: Rs. ${Math.round(summary.fixedExpenses).toLocaleString('en-IN')} fixed / Rs. ${Math.round(
      summary.variableExpenses
    ).toLocaleString('en-IN')} variable`
  );
  addLine(`Unnecessary / Discretionary Spend: Rs. ${Math.round(summary.unnecessaryExpenses).toLocaleString('en-IN')}`);
  addLine(`Financial Health Score: ${summary.healthScore.score}/100 (${summary.healthScore.label})`);

  y += 10;
  addLine('Category-Wise Spending Breakdown', 14, true, [91, 33, 182]);
  const sortedCategories = Object.entries(summary.categoryTotals).sort((a, b) => b[1] - a[1]);
  if (sortedCategories.length === 0) {
    addLine('No expenses recorded in this period.');
  } else {
    for (const [cat, amt] of sortedCategories) {
      const share = summary.totalExpenses > 0 ? ((amt / summary.totalExpenses) * 100).toFixed(1) : '0.0';
      addLine(`- ${cat}: Rs. ${Math.round(amt).toLocaleString('en-IN')} (${share}%)`);
    }
  }

  y += 10;
  addLine('Savings Goals Progress', 14, true, [91, 33, 182]);
  if (goals.length === 0) {
    addLine('No active savings goals.');
  } else {
    for (const g of goals) {
      const pct = g.targetAmount > 0 ? ((g.currentSavings / g.targetAmount) * 100).toFixed(1) : '0.0';
      addLine(
        `- ${g.title} (${g.category}): Rs. ${Math.round(g.currentSavings).toLocaleString('en-IN')} / Rs. ${Math.round(
          g.targetAmount
        ).toLocaleString('en-IN')} (${pct}%)`
      );
    }
  }

  y += 10;
  addLine('Active Loans & Borrowed/Lent', 14, true, [91, 33, 182]);
  if (loans.length === 0) {
    addLine('No loan records.');
  } else {
    for (const l of loans) {
      addLine(
        `- ${l.title} [${l.loanType}]: Remaining Rs. ${Math.round(l.remainingAmount).toLocaleString('en-IN')} (${
          l.status
        })`
      );
    }
  }

  y += 10;
  addLine(`Recent Expenses (${Math.min(expenses.length, 25)} shown)`, 14, true, [91, 33, 182]);
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
  for (const e of recent) {
    addLine(
      `${formatDateShort(e.date)}  |  ${e.name}  |  ${e.category}  |  ${e.paymentMethod}  |  Rs. ${Math.round(
        e.amount
      ).toLocaleString('en-IN')}`,
      9
    );
  }

  doc.save(`MoneyWise_Report_${periodLabel.replace(/\s+/g, '_')}.pdf`);
}

export async function exportReportToExcel(params: {
  periodLabel: string;
  summary: FinancialSummary;
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
  budgets: Budget[];
  goals: SavingsGoal[];
  loans: Loan[];
}) {
  const { periodLabel, summary, incomes, expenses, budgets, goals, loans } = params;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MoneyWise';

  const summarySheet = wb.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 34 },
    { header: 'Value', key: 'value', width: 28 },
  ];
  summarySheet.addRows([
    { metric: 'Report Period', value: periodLabel },
    { metric: 'Monthly Salary (INR)', value: summary.monthlySalary },
    { metric: 'Additional Income (INR)', value: summary.additionalIncome },
    { metric: 'Total Income (INR)', value: summary.totalIncome },
    { metric: 'Total Expenses (INR)', value: summary.totalExpenses },
    { metric: 'Total Savings / Net Balance (INR)', value: summary.totalSavings },
    { metric: 'Savings Percentage (%)', value: Number(summary.savingsPercentage.toFixed(2)) },
    { metric: 'Fixed Expenses (INR)', value: summary.fixedExpenses },
    { metric: 'Variable Expenses (INR)', value: summary.variableExpenses },
    { metric: 'Unnecessary Expenses (INR)', value: summary.unnecessaryExpenses },
    { metric: 'Financial Health Score', value: `${summary.healthScore.score}/100 (${summary.healthScore.label})` },
  ]);

  const expSheet = wb.addWorksheet('Expenses');
  expSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Amount (INR)', key: 'amount', width: 16 },
    { header: 'Payment Method', key: 'paymentMethod', width: 18 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Discretionary', key: 'discretionary', width: 14 },
    { header: 'Description', key: 'description', width: 32 },
  ];
  expSheet.addRows(
    expenses.map((e) => ({
      date: e.date,
      name: e.name,
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      type: e.isFixed ? 'Fixed' : 'Variable',
      discretionary: e.isUnnecessary ? 'Yes' : 'No',
      description: e.description || '',
    }))
  );

  const incSheet = wb.addWorksheet('Income');
  incSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Title', key: 'title', width: 28 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Amount (INR)', key: 'amount', width: 16 },
    { header: 'Description', key: 'description', width: 32 },
  ];
  incSheet.addRows(
    incomes.map((i) => ({
      date: i.date,
      title: i.title,
      category: i.category,
      amount: i.amount,
      description: i.description || '',
    }))
  );

  const budSheet = wb.addWorksheet('Budgets');
  budSheet.columns = [
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Period', key: 'period', width: 14 },
    { header: 'Limit (INR)', key: 'limit', width: 16 },
    { header: 'Spent (INR)', key: 'spent', width: 16 },
    { header: 'Remaining (INR)', key: 'remaining', width: 16 },
    { header: 'Utilization (%)', key: 'pct', width: 16 },
  ];
  budSheet.addRows(
    budgets.map((b) => {
      const spent = summary.categoryTotals[b.category] ?? 0;
      return {
        category: b.category,
        period: b.period,
        limit: b.limitAmount,
        spent,
        remaining: b.limitAmount - spent,
        pct: b.limitAmount > 0 ? Number(((spent / b.limitAmount) * 100).toFixed(1)) : 0,
      };
    })
  );

  const goalSheet = wb.addWorksheet('Savings Goals');
  goalSheet.columns = [
    { header: 'Goal', key: 'title', width: 28 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Target (INR)', key: 'target', width: 16 },
    { header: 'Current Savings (INR)', key: 'current', width: 20 },
    { header: 'Remaining (INR)', key: 'remaining', width: 16 },
    { header: 'Target Date', key: 'targetDate', width: 14 },
  ];
  goalSheet.addRows(
    goals.map((g) => ({
      title: g.title,
      category: g.category,
      target: g.targetAmount,
      current: g.currentSavings,
      remaining: Math.max(0, g.targetAmount - g.currentSavings),
      targetDate: g.targetDate,
    }))
  );

  const loanSheet = wb.addWorksheet('Loans');
  loanSheet.columns = [
    { header: 'Title', key: 'title', width: 28 },
    { header: 'Type', key: 'type', width: 18 },
    { header: 'Counterparty', key: 'counterparty', width: 22 },
    { header: 'Principal (INR)', key: 'principal', width: 16 },
    { header: 'Remaining (INR)', key: 'remaining', width: 16 },
    { header: 'EMI (INR)', key: 'emi', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  loanSheet.addRows(
    loans.map((l) => ({
      title: l.title,
      type: l.loanType,
      counterparty: l.counterparty,
      principal: l.principalAmount,
      remaining: l.remainingAmount,
      emi: l.emiAmount,
      status: l.status,
    }))
  );

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `MoneyWise_Report_${periodLabel.replace(/\s+/g, '_')}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
