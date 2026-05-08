import type { TeamItem } from '@/types/team'

export const fixedTestingTeams: TeamItem[] = [
  {
    id: 'testing-google-xts',
    name: 'Google XTS',
    type: 'testing',
    enabled: true,
    note: '软件质量保障二中心-系统质量三部-Google测试组',
  },
  {
    id: 'testing-system',
    name: '系统测试组',
    type: 'testing',
    enabled: true,
    note: '软件质量保障二中心-系统质量三部-系统测试一组，软件质量保障二中心-系统质量二部-运营商系统测试二组，软件质量保障二中心-系统质量二部-运营商系统测试三组，软件质量保障二中心-系统质量三部-系统测试二组，软件质量保障二中心-系统质量二部-运营商系统测试组，软件质量保障二中心-系统质量三部-应用测试组',
  },
  {
    id: 'testing-na-delivery',
    name: '北美需求交付组',
    type: 'testing',
    enabled: true,
    note: '软件质量保障二中心-系统质量二部-北美需求交付组',
  },
  {
    id: 'testing-na',
    name: '北美测试部',
    type: 'testing',
    enabled: true,
    note: '软件质量保障二中心-北美测试部',
  },
  {
    id: 'testing-special',
    name: '专项测试组',
    type: 'testing',
    enabled: true,
    note: '软件质量保障二中心-专项与协议测试部-专项自动化组，软件质量保障二中心-专项与协议测试部-运营商专项测试二组，软件质量保障二中心-专项与协议测试部-运营商专项测试一组',
  },
  {
    id: 'testing-protocol',
    name: '协议测试组',
    type: 'testing',
    enabled: true,
    note: '软件质量保障二中心-专项与协议测试部-运营商协议测试一组，软件质量保障二中心-专项与协议测试部-运营商协议测试二组',
  },
  {
    id: 'testing-pipeline',
    name: '流水线',
    type: 'testing',
    enabled: true,
    note: '软件质量保障二中心-系统质量二部-质效自动化组，测试未知团队-swtc_devops',
  },
  {
    id: 'testing-hera-user-apruut',
    name: 'Hera/Usersupport/APRUUT',
    type: 'testing',
    enabled: true,
    note: 'MP PL-PQ-QPM Team，MP PL-Q&CC-PQ&NPS，MP BU-Q&CC-PQ&NPS，测试未知团队-usersupport，测试未知团队-devops.tms',
  },
]

export const fixedDevelopmentTeams: TeamItem[] = [
  {
    id: 'development-protocol',
    name: '协议技术部',
    type: 'development',
    enabled: true,
    note: '移动解决方案中心-协议技术部-协议开发一组，移动解决方案中心-协议技术部-协议开发二组，系统应用开发中心-协议技术部-协议开发一组，移动解决方案二中心-协议技术部-协议开发一组，移动解决方案二中心-协议技术部-协议开发四组，移动解决方案二中心-协议技术部-协议开发二组',
  },
  {
    id: 'development-bsp',
    name: '底软技术部',
    type: 'development',
    enabled: true,
    note: '移动解决方案中心-底软技术部-系统开发二组，移动解决方案中心-底软技术部-设备安全组，移动解决方案中心-底软技术部-充电方案组，移动解决方案中心-底软技术部-工业生产组，移动解决方案中心-底软技术部-系统开发一组，移动解决方案中心-底软技术部-系统开发三组，移动解决方案中心-底软技术部-机芯平台组，移动解决方案中心-底软技术部，移动解决方案中心-底软技术部-功耗充电组，移动解决方案一中心-底软技术部-机芯预研组，移动解决方案一中心-底软技术部-设备安全组，移动解决方案一中心-底软技术部-系统开发一组，移动解决方案一中心-底软技术部-功耗充电组，移动解决方案一中心-底软技术部-系统开发二组，移动解决方案一中心-底软技术部-DFX组，移动解决方案一中心-底软技术部-ODC一组',
  },
  {
    id: 'development-system',
    name: '系统技术部',
    type: 'development',
    enabled: true,
    note: '移动解决方案中心-系统技术部-交互窗口组，移动解决方案中心-系统技术部-多媒体连接组，移动解决方案中心-系统技术部-框架开发一组，移动解决方案中心-系统技术部-框架开发二组，移动解决方案中心-系统技术部-显示技术组，移动解决方案中心-系统技术部-核心服务组，移动解决方案中心-系统技术部-续航优化组，移动解决方案中心-系统技术部-系统稳定性组，移动解决方案中心-系统技术部，移动解决方案一中心-系统技术部-多媒体连接组，移动解决方案一中心-系统技术部-性能解决方案组，移动解决方案一中心-系统技术部-核心服务组，移动解决方案一中心-系统技术部-框架开发一组，移动解决方案一中心-系统技术部-交互窗口组，移动解决方案一中心-系统技术部-竞争力技术组，移动解决方案一中心-系统技术部-框架开发二组，移动解决方案一中心-系统技术部-系统稳定性组',
  },
  {
    id: 'development-carrier-app',
    name: '运营商应用开发部',
    type: 'development',
    enabled: true,
    note: '系统应用开发中心-运营商应用开发部-通话应用组，系统应用开发中心-运营商应用开发部-通话服务组，系统应用开发中心-运营商应用开发部-运营商服务组，系统应用开发中心-运营商应用开发部-信息应用组，系统应用开发中心-运营商应用开发部，移动解决方案二中心-运营商应用开发部-通信应用组，移动解决方案二中心-运营商应用开发部-武汉ODC组，移动解决方案二中心-运营商应用开发部-通话服务组，系统应用开发中心-运营商应用开发部-通信应用组，移动解决方案二中心-运营商应用开发部-工具应用组，移动解决方案二中心-运营商应用开发部-系统更新服务组',
  },
  {
    id: 'development-basic-app',
    name: '基础应用开发部',
    type: 'development',
    enabled: true,
    note: '系统应用开发中心-基础应用开发部-系统基础应用组，系统应用开发中心-基础应用开发部-门户基础应用组，系统应用开发中心-基础应用开发部-多媒体基础应用组，系统应用开发中心-基础应用开发部-应用技术组，系统应用开发中心-基础应用开发部，移动解决方案二中心-基础应用开发部-系统基础应用组，移动解决方案二中心-基础应用开发部-应用技术组，移动解决方案二中心-基础应用开发部-多媒体基础应用组，移动解决方案二中心-基础应用开发部-三方与平台应用组',
  },
  {
    id: 'development-independent-app',
    name: '独立应用开发部',
    type: 'development',
    enabled: true,
    note: '系统应用开发中心-独立应用开发部-网络服务组，系统应用开发中心-独立应用开发部-工具服务组，系统应用开发中心-独立应用开发部-桌面应用组，系统应用开发中心-独立应用开发部-武汉ODC组，系统应用开发中心-独立应用开发部-穿戴服务组，系统应用开发中心-独立应用开发部-内容平台组，互联网应用开发中心-独立应用开发部-桌面应用组，互联网应用开发中心-独立应用开发部-AI应用组，互联网应用开发中心-独立应用开发部-运营业务组，互联网应用开发中心-独立应用开发部-创新应用组',
  },
  {
    id: 'development-engineering-efficiency',
    name: '工程效能部',
    type: 'development',
    enabled: true,
    note: '系统技术中心-工程效能部-WSL工具开发组，系统技术中心-工程效能部-通讯项目交付组，系统技术中心-工程效能部-FCM平台开发组，系统技术中心-工程效能部-通讯交付组',
  },
  {
    id: 'development-terminal-os',
    name: '终端OS部',
    type: 'development',
    enabled: true,
    note: '系统技术中心-终端OS部-性能解决方案组，系统技术中心-终端OS部-系统优化组',
  },
  {
    id: 'development-camera',
    name: 'Camera',
    type: 'development',
    enabled: true,
    note: 'MP PL-Tech.&Inno.-Camera LAB-APP Team，MP PL-R&D-Camera LAB-APP Team，MP PL-Tech.&Inno.-Camera LAB-HAL Team，MP PL-R&D-Camera LAB-HAL Team，MP PL-Tech.&Inno.-Camera LAB，MP PL-R&D-Camera LAB，MP PL-Tech.&Inno.-Camera LAB-Tuning Team，MP PL-R&D-Camera LAB-IQA Team，MP PL-R&D-Camera LAB-Tuning Team，MP BU-R&D-Camlab-APP Team，MP BU-R&D-Camlab-CamPM Team，MP BU-R&D-Camlab-HAL Team，MP BU-R&D-Camlab-IQA Team，MP BU-R&D-Camlab-Tuning Team',
  }
]

export const initialTeams: TeamItem[] = [
  ...fixedTestingTeams,
  ...fixedDevelopmentTeams,
]
