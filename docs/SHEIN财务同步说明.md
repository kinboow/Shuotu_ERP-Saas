# SHEIN 财务自动同步说明

本次已完成从 SHEIN 财务 API 自动同步到 ERP 本地库：

- 报账单列表：`/open-api/finance/report-list`
- 报账单销售款明细：`/open-api/finance/report-sales-detail`
- 报账单补扣款明细：`/open-api/finance/report-adjustment-detail`

## 1. 同步入口

沿用已有异步批量同步接口：

`POST /api/shein-full-sync/batch`

示例请求：

```json
{
  "shopIds": [1],
  "dataTypes": ["reports"],
  "lastUpdateTimeStart": "2025-01-01 00:00:00",
  "lastUpdateTimeEnd": "2025-01-07 23:59:59",
  "syncReportDetails": true,
  "reportDetailPerPage": 200
}
```

说明：

- `dataTypes` 包含 `reports` 或 `finance` 时，会触发财务同步。
- `syncReportDetails` 默认 `true`，会在同步报账单后自动拉取销售明细与补扣款明细。

## 2. 本地查询接口

新增接口：

`POST /api/shein-full/finance-reports/local`

示例请求：

```json
{
  "shopId": 1,
  "page": 1,
  "pageSize": 20,
  "reportOrderNo": "",
  "includeDetails": false
}
```

说明：

- `includeDetails=true` 时返回每个报账单下的 `salesDetails` 和 `adjustmentDetails`。

## 3. 数据表

已新增（并支持幂等落库）：

- `shein_full_finance_reports`（已有）
- `shein_full_finance_report_sales_details`（新增）
- `shein_full_finance_report_adjustment_details`（新增）

