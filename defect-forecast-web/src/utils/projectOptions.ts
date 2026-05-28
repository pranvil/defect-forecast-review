/**
 * 项目参数可选值常量
 *
 * 同时被 "新项目信息"（ParamsPage）与 "系统配置 → 历史项目元数据"（HistoricalProjectMetadataCard）
 * 使用。维护时只改这一处，避免两处选项漂移。
 */

export const PROJECT_CATEGORY_OPTIONS = [
  'SOC',
  'NPI leading',
  'Variant',
  'OS Update',
  '中国区定制',
  'IDH联合项目',
  'IDH全O',
  '其他',
] as const

export const REGION_OPTIONS = ['US', 'CA', 'CN', 'GL', 'NA', 'All', 'NA OM'] as const

export const OS_OPTIONS = ['Android', 'Kaios', 'AOSP', '其他'] as const

export const DEVICE_TYPE_OPTIONS = ['Smart phone', 'Feature phone', 'Tablet', 'POS', '其他'] as const

export const CHIPSET_VENDOR_OPTIONS = ['MTK', 'Qualcomm', '其他'] as const

export const CHIPSET_NEWNESS_OPTIONS = ['Old', 'New'] as const

export const CHIPSET_STATUS_OPTIONS = ['Old_MTK', 'New_MTK', 'Old_Qualcomm', 'New_Qualcomm'] as const

export const OPERATOR_OPTIONS = [
  'All',
  'US_VZW',
  'US_TMO',
  'US_ATT',
  'US_USCC',
  'US_DISH',
  'US_Spectrum',
  'US_OM',
  'US_BBH',
  'CA_Rogers',
  'CA_Bell',
  'CA_Telus',
  'CA_Quebecor',
  '其他',
] as const

export const USER_PROGRAM_OPTIONS = ['IUT', 'FUT', '内测', '体验'] as const

export const IDH_VENDOR_OPTIONS = ['麦博', '驰腾', '传佳音', '英卡', '其他'] as const

export const PIPELINE_OPTIONS = ['冒烟', '无冒烟', '全部', '不部署'] as const

export const SUPPORT_SIM_OPTIONS = ['Yes', 'No'] as const
