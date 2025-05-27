import { Context } from 'koishi';

export interface Config {
  key: string
  userAgent: string
  master: {
    enable: boolean
    platform: string
    masterAccount: string
    masterAccountGuildId: string
  }
  sub: Array<{
    name: string
    uid: string
    dynamic: boolean
    live: boolean
    card: {
      enable: boolean
      cardColorStart: string
      cardColorEnd: string
      cardBasePlateColor: string
      cardBasePlateBorder: string
    }
    target: Array<{
      channelArr: Array<{
        channelId: string
        dynamic: boolean
        live: boolean
        liveGuardBuy: boolean
        atAll: boolean
      }>
      platform: string
    }>
  }>
  dynamicUrl: boolean
  pushImgsInDynamic: boolean
  restartPush: boolean
  pushTime: number
  customLiveStart: string
  customLive: string
  customLiveEnd: string
  followerDisplay: boolean
  hideDesc: boolean
  removeBorder: boolean
  cardColorStart: string
  cardColorEnd: string
  cardBasePlateColor: string
  cardBasePlateBorder: string
  enableLargeFont: boolean
  filter: {
    enable: boolean
    notify: boolean
    regex: string
    keywords: Array<string>
  }
  dynamicDebugMode: boolean
}

export interface Result {
  code: number
  msg: string
}

export interface MasterInfo {
  name: string
  face: string
  follower: number
}

export type LiveType = 'start' | 'end' | 'guard'

export type PushType = 'dynamic' | 'live'

export interface Target {
  channelArr: Array<{
    channelId: string
    dynamic: boolean
    live: boolean
    liveGuardBuy: boolean
    atAll: boolean
  }>
  platform: string
}

export interface SubItem {
  uid: string
  dynamic: boolean
  live: boolean
  target: Target[]
  card: {
    enable: boolean
    cardColorStart: string
    cardColorEnd: string
    cardBasePlateColor: string
    cardBasePlateBorder: string
  }
}

export type SubManager = SubItem[]

export interface LiveUsers {
  uid: number
  uname: string
  face: string
  guard_level: number
}

export interface AllDynamicInfo {
  id: string
  uid: string
  type: number
  content: string
  timestamp: number
  images?: string[]
} 
