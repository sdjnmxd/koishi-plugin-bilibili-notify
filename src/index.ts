import { type Context, type ForkScope, Schema, Service } from "koishi";
import {} from "@koishijs/plugin-notifier";
// import plugins
import ComRegister from "./comRegister";
import * as Database from "./database";
// import Service
import GenerateImg from "./generateImg";
import BiliAPI from "./biliAPI";
import BLive from "./blive";

export const inject = ["puppeteer", "database", "notifier"];

export const name = "bilibili-notify";

let globalConfig: Config;

declare module "koishi" {
	interface Context {
		sm: ServerManager;
	}
}

class ServerManager extends Service {
	// 服务
	servers: ForkScope[] = [];

	constructor(ctx: Context) {
		super(ctx, "sm");

		// 插件运行相关指令
		const sysCom = ctx.command("sys", "bili-notify插件运行相关指令", {
			permissions: ["authority:5"],
		});

		sysCom
			.subcommand(".restart", "重启插件")
			.usage("重启插件")
			.example("sys restart")
			.action(async () => {
				this.logger.info("调用sys restart指令");
				if (await this.restartPlugin()) {
					return "插件重启成功";
				}
				return "插件重启失败";
			});

		sysCom
			.subcommand(".stop", "停止插件")
			.usage("停止插件")
			.example("sys stop")
			.action(async () => {
				this.logger.info("调用sys stop指令");
				if (await this.disposePlugin()) {
					return "插件已停止";
				}
				return "停止插件失败";
			});

		sysCom
			.subcommand(".start", "启动插件")
			.usage("启动插件")
			.example("sys start")
			.action(async () => {
				this.logger.info("调用sys start指令");
				if (await this.registerPlugin()) {
					return "插件启动成功";
				}
				return "插件启动失败";
			});
	}

	protected start(): void | Promise<void> {
		// 注册插件
		if (!this.registerPlugin()) {
			this.logger.error("插件启动失败");
		}
	}

	registerPlugin = () => {
		// 如果已经有服务则返回false
		if (this.servers.length !== 0) return false;
		// 注册插件
		try {
			// BA = BiliAPI
			const ba = this.ctx.plugin(BiliAPI, {
				userAgent: globalConfig.userAgent,
				key: globalConfig.key,
			});

			// GI = GenerateImg
			const gi = this.ctx.plugin(GenerateImg, {
				dynamicFilter: globalConfig.dynamicFilter,
				removeBorder: globalConfig.removeBorder,
				cardColorStart: globalConfig.cardColorStart,
				cardColorEnd: globalConfig.cardColorEnd,
				cardBasePlateColor: globalConfig.cardBasePlateColor,
				cardBasePlateBorder: globalConfig.cardBasePlateBorder,
				hideDesc: globalConfig.hideDesc,
				enableLargeFont: globalConfig.enableLargeFont,
				font: globalConfig.font,
				followerDisplay: globalConfig.followerDisplay,
			});

			// CR = ComRegister
			const cr = this.ctx.plugin(ComRegister, {
				sub: globalConfig.sub,
				master: globalConfig.master,
				restartPush: globalConfig.restartPush,
				pushTime: globalConfig.pushTime,
				pushImgsInDynamic: globalConfig.pushImgsInDynamic,
				customLiveStart: globalConfig.customLiveStart,
				customLive: globalConfig.customLive,
				customLiveEnd: globalConfig.customLiveEnd,
				dynamicUrl: globalConfig.dynamicUrl,
				dynamicFilter: globalConfig.dynamicFilter,
				liveFilter: globalConfig.liveFilter,
				dynamicDebugMode: globalConfig.dynamicDebugMode,
			});

			// BL = BLive
			const bl = this.ctx.plugin(BLive);

			// 添加服务
			this.servers.push(ba);
			this.servers.push(bl);
			this.servers.push(gi);
			this.servers.push(cr);
		} catch (e) {
			this.logger.error("插件注册失败", e);
			return false;
		}
		// 成功返回true
		return true;
	};

	disposePlugin = async () => {
		// 如果没有服务则返回false
		if (this.servers.length === 0) return false;
		// 遍历服务
		await new Promise((resolve) => {
			for (const fork of this.servers) {
				fork.dispose();
			}
			// 清空服务
			this.servers = [];
			resolve("ok");
		});
		// 成功返回true
		return true;
	};

	restartPlugin = async (): Promise<boolean> => {
		// 如果没有服务则返回false
		if (this.servers.length === 0) return false;
		// 停用插件
		await this.disposePlugin();
		// 隔一秒启动插件
		return new Promise((resolve) => {
			this.ctx.setTimeout(() => {
				try {
					this.registerPlugin();
				} catch (e) {
					this.logger.error("重启插件失败", e);
					resolve(false);
				}
				resolve(true);
			}, 1000);
		});
	};
}

export function apply(ctx: Context, config: Config) {
	// 设置config
	globalConfig = config;
	// 设置提示
	ctx.notifier.create({
		type: "success",
		content: "魔改版本",
	});
	// load database
	ctx.plugin(Database);
	// Register ServerManager
	ctx.plugin(ServerManager);
}

export interface Config {
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	require: {};
	key: string;
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	master: {};
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	basicSettings: {};
	userAgent: string;
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	subTitle: {};
	sub: Array<{
		name: string;
		uid: string;
		dynamic: boolean;
		live: boolean;
		// biome-ignore lint/complexity/noBannedTypes: <explanation>
		card: {};
		target: Array<{
			channelArr: Array<{
				channelId: string;
				dynamic: boolean;
				live: boolean;
				liveGuardBuy: boolean;
				atAll: boolean;
			}>;
			platform: string;
		}>;
	}>;
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	dynamic: {};
	dynamicUrl: boolean;
	pushImgsInDynamic: boolean;
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	live: {};
	restartPush: boolean;
	pushTime: number;
	customLiveStart: string;
	customLive: string;
	customLiveEnd: string;
	followerDisplay: boolean;
	hideDesc: boolean;
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	style: {};
	removeBorder: boolean;
	cardColorStart: string;
	cardColorEnd: string;
	cardBasePlateColor: string;
	cardBasePlateBorder: string;
	enableLargeFont: boolean;
	font: string;
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	dynamicFilter: {};
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	liveFilter: {};
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	debug: {};
	dynamicDebugMode: boolean;
}

export const Config: Schema<Config> = Schema.object({
	require: Schema.object({}).description("必填设置"),

	key: Schema.string()
		.pattern(/^[0-9a-f]{32}$/)
		.role("secret")
		.required()
		.description(
			"请输入一个32位小写字母的十六进制密钥（例如：9b8db7ae562b9864efefe06289cc5530），使用此密钥将你的B站登录信息存储在数据库中，请一定保存好此密钥。如果你忘记了此密钥，必须重新登录。你可以自行生成，或到这个网站生成：https://www.sexauth.com/",
		),

	master: Schema.intersect([
		Schema.object({
			enable: Schema.boolean()
				.default(false)
				.description(
					"是否开启主人账号功能，如果您的机器人没有私聊权限请不要开启此功能。开启后如果机器人运行错误会向您进行报告",
				),
		}).description("主人账号"),
		Schema.union([
			Schema.object({
				enable: Schema.const(true).required(),
				platform: Schema.union([
					"qq",
					"qqguild",
					"onebot",
					"discord",
					"red",
					"telegram",
					"satori",
					"chronocat",
					"lark",
				]).description(
					"请选择您的私人机器人平台，目前支持QQ、QQ群、OneBot、Discord、RedBot、Telegram、Satori、ChronoCat、Lark。从2.0版本开始，只能在一个平台下使用本插件",
				),
				masterAccount: Schema.string()
					.role("secret")
					.required()
					.description(
						"主人账号，在Q群使用可直接使用QQ号，若在其他平台使用，请使用inspect插件获取自身ID",
					),
				masterAccountGuildId: Schema.string()
					.role("secret")
					.description(
						"主人账号所在的群组ID，只有在QQ频道、Discord这样的环境才需要填写，请使用inspect插件获取群组ID",
					),
			}),
			Schema.object({}),
		]),
	]),

	basicSettings: Schema.object({}).description("基本设置"),

	userAgent: Schema.string()
		.required()
		.description(
			"设置请求头User-Agen，请求出现-352时可以尝试修改，UA获取方法可参考：https://blog.csdn.net/qq_44503987/article/details/104929111",
		),

	subTitle: Schema.object({}).description("订阅配置"),

	sub: Schema.array(
		Schema.object({
			name: Schema.string().description(
				"订阅用户昵称，只是给你自己看的(相当于备注)，可填可不填",
			),
			uid: Schema.string().required().description("订阅用户UID"),
			dynamic: Schema.boolean().default(false).description("是否订阅用户动态"),
			live: Schema.boolean().default(false).description("是否订阅用户直播"),
			target: Schema.array(
				Schema.object({
					platform: Schema.string()
						.required()
						.description("推送平台，例如onebot、qq、discord"),
					channelArr: Schema.array(
						Schema.object({
							channelId: Schema.string().required().description("频道/群组号"),
							dynamic: Schema.boolean()
								.default(false)
								.description("该频道/群组是否推送动态信息"),
							live: Schema.boolean()
								.default(false)
								.description("该频道/群组是否推送直播通知"),
							liveGuardBuy: Schema.boolean()
								.default(false)
								.description("该频道/群组是否推送上舰消息"),
							atAll: Schema.boolean()
								.default(false)
								.description("推送开播通知时是否艾特全体成员"),
						}),
					)
						.role("table")
						.required()
						.description("需推送的频道/群组详细设置"),
				}),
			).description(
				"订阅用户需要发送的平台和频道/群组信息(一个平台下可以推送多个频道/群组)",
			),
			card: Schema.intersect([
				Schema.object({
					enable: Schema.boolean()
						.default(false)
						.description("是否开启自定义卡片颜色"),
				}),
				Schema.union([
					Schema.object({
						enable: Schema.const(true).required(),
						cardColorStart: Schema.string()
							.pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
							.description(
								"推送卡片的开始渐变背景色，请填入16进制颜色代码，参考网站：https://webkul.github.io/coolhue/",
							),
						cardColorEnd: Schema.string()
							.pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
							.description(
								"推送卡片的结束渐变背景色，请填入16进制颜色代码，参考网站：https://colorate.azurewebsites.net/",
							),
						cardBasePlateColor: Schema.string()
							.pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
							.description("推送卡片底板颜色，请填入16进制颜色代码"),
						cardBasePlateBorder: Schema.string()
							.pattern(/\d*\.?\d+(?:px|em|rem|%|vh|vw|vmin|vmax)/)
							.description(
								"推送卡片底板边框宽度，请填入css单位，例如1px，12.5rem，100%",
							),
					}),
					Schema.object({}),
				]),
			]),
		}).collapse(),
	)
		.collapse()
		.description(
			"输入订阅信息，自定义订阅内容； uid: 订阅用户UID，dynamic: 是否需要订阅动态，live: 是否需要订阅直播",
		),

	dynamic: Schema.object({}).description("动态推送设置"),

	dynamicUrl: Schema.boolean()
		.default(false)
		.description(
			"发送动态时是否同时发送链接。注意：如果使用的是QQ官方机器人不能开启此项！",
		),

	pushImgsInDynamic: Schema.boolean()
		.default(false)
		.description(
			"是否推送动态中的图片，默认不开启。开启后会单独推送动态中的图片",
		),

	live: Schema.object({}).description("直播推送设置"),

	restartPush: Schema.boolean()
		.default(true)
		.description(
			"插件重启后，如果订阅的主播正在直播，是否进行一次推送，默认开启",
		),

	pushTime: Schema.number()
		.min(0)
		.max(12)
		.step(0.5)
		.default(1)
		.description("设定间隔多长时间推送一次直播状态，单位为小时，默认为一小时"),

	customLiveStart: Schema.string()
		.default("-name开播啦，当前粉丝数：-follower\\n-link")
		.description(
			"自定义开播提示语，-name代表UP昵称，-follower代表当前粉丝数，-link代表直播间链接（如果使用的是QQ官方机器人，请不要使用），\\n为换行。例如-name开播啦，会发送为xxxUP开播啦",
		),

	customLive: Schema.string()
		.default("-name正在直播，目前已播-time，累计观看人数：-watched\\n-link")
		.description(
			"自定义直播中提示语，-name代表UP昵称，-time代表开播时长，-watched代表累计观看人数，-link代表直播间链接（如果使用的是QQ官方机器人，请不要使用），\\n为换行。例如-name正在直播，会发送为xxxUP正在直播xxx",
		),

	customLiveEnd: Schema.string()
		.default("-name下播啦，本次直播了-time，粉丝数变化-follower_change")
		.description(
			"自定义下播提示语，-name代表UP昵称，-follower_change代表本场直播粉丝数变，-time代表开播时长，\\n为换行。例如-name下播啦，本次直播了-time，会发送为xxxUP下播啦，直播时长为xx小时xx分钟xx秒",
		),

	followerDisplay: Schema.boolean()
		.default(true)
		.description("粉丝数变化和累积观看本场直播的人数是否显示在推送卡片中"),

	hideDesc: Schema.boolean()
		.default(false)
		.description("是否隐藏UP主直播间简介，开启后推送的直播卡片将不再展示简介"),

	style: Schema.object({}).description("美化设置"),

	removeBorder: Schema.boolean().default(false).description("移除推送卡片边框"),

	cardColorStart: Schema.string()
		.pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
		.default("#F38AB5")
		.description(
			"推送卡片的开始渐变背景色，请填入16进制颜色代码，参考网站：https://webkul.github.io/coolhue/",
		),

	cardColorEnd: Schema.string()
		.pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
		.default("#F9CCDF")
		.description(
			"推送卡片的结束渐变背景色，请填入16进制颜色代码，参考网站：https://colorate.azurewebsites.net/",
		),

	cardBasePlateColor: Schema.string()
		.pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
		.default("#FFF5EE")
		.description("推送卡片底板颜色，请填入16进制颜色代码"),

	cardBasePlateBorder: Schema.string()
		.pattern(/\d*\.?\d+(?:px|em|rem|%|vh|vw|vmin|vmax)/)
		.default("15px")
		.description("推送卡片底板边框宽度，请填入css单位，例如1px，12.5rem，100%"),

	enableLargeFont: Schema.boolean()
		.default(false)
		.description(
			"是否开启动态推送卡片大字体模式，默认为小字体。小字体更漂亮，但阅读比较吃力，大字体更易阅读，但相对没这么好看",
		),

	font: Schema.string().description(
		"推送卡片的字体样式，如果你想用你自己的字体可以在此填写，例如：Microsoft YaHei",
	),

	dynamicFilter: Schema.object({
		enable: Schema.boolean().description("是否启用动态屏蔽"),
		regex: Schema.string().description("正则表达式屏蔽规则"),
		keywords: Schema.array(String).description("关键词屏蔽列表"),
	}).description("动态屏蔽设置"),

	liveFilter: Schema.object({
		enable: Schema.boolean().description("是否启用直播屏蔽"),
		regex: Schema.string().description("正则表达式屏蔽规则"),
		keywords: Schema.array(String).description("关键词屏蔽列表"),
	}).description("直播屏蔽设置"),

	debug: Schema.object({}).description("调试设置"),

	dynamicDebugMode: Schema.boolean()
		.default(false)
		.description(
			"动态调试模式，开启后会在控制台输出动态推送的详细信息，用于调试",
		)
		.experimental(),
});
