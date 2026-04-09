export interface FieldMapping {
  id: string
  businessName: string
  jiraFieldPath: string
  purpose: string
  exampleValue: string
  enabled: boolean
}

export type JiraAuthType = 'pat' | 'basic'

export interface JiraConnectionConfig {
  baseUrl: string
  authType: JiraAuthType
  username: string
  token: string
  verifySsl: boolean
  timeoutSec: number
}
