import type { ExportService } from '@/services/exportService'

export const exportServiceReview: ExportService = {
  async exportForecastToExcel() {
    throw new Error('评审版暂未开放：Excel 导出需要本机导出服务')
  },
}

