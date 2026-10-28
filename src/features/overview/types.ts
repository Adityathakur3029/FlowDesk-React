import type { components, paths } from '@/api/schema'

export type OverviewReport = components['schemas']['OverviewReport']
export type OverviewTotals = components['schemas']['OverviewTotals']
export type TrendBucket = components['schemas']['TrendBucket']
export type TeamReportRow = components['schemas']['TeamReportRow']
export type ProgramReportRow = components['schemas']['ProgramReportRow']
export type BoardReportRow = components['schemas']['BoardReportRow']
export type ReportGranularity = components['schemas']['ReportPeriod']['granularity']
export type OverviewParams = paths['/reports/overview']['get']['parameters']['query']
export type ReportScope = NonNullable<OverviewParams['scope']>
