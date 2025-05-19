import { Context } from 'koishi'

interface RetryOptions {
	attempts: number;
	onFailure?: (error: Error, attempts: number) => Promise<void> | void;
}

export function Retry(
	options: RetryOptions = { attempts: 3 },
): MethodDecorator {
	return (
		// biome-ignore lint/complexity/noBannedTypes: <explanation>
		target: Object,
		propertyKey: string | symbol,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		descriptor: TypedPropertyDescriptor<any>,
	) => {
		const originalMethod = descriptor.value;

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		descriptor.value = async function (...args: any[]) {
			let lastError: Error;

			for (let i = 0; i < options.attempts; i++) {
				try {
					return await originalMethod.apply(this, args);
				} catch (error) {
					lastError = error as Error;
					if (options.onFailure) {
						await options.onFailure.call(this, lastError, i + 1);
					}
				}
			}

			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			throw lastError!;
		};

		return descriptor;
	};
}

/**
 * 高阶函数：为函数添加锁机制
 * @param {Function} fn - 需要包装的原始函数
 * @returns {Function} 带锁功能的函数
 */
export function withLock(fn) {
	// 判断是否是异步函数
	const isAsync = fn.constructor.name === "AsyncFunction";
	// 定义锁标志
	let locked = false;

	// 判断是否为异步函数
	if (isAsync) {
		// 变为Promise
		return (...args) => {
			// 已加锁则跳过执行
			if (locked) return;
			// 获取锁
			locked = true;

			// 将异步函数转为Promise链
			Promise.resolve(fn(...args))
				.catch((err) => {
					// 打印错误
					console.error("Execution error:", err);
					// 重新抛出错误
					throw err;
				})
				.finally(() => {
					// 确保释放锁
					locked = false;
				});
		};
	}

	// 不是异步函数
	return (...args) => {
		// 已加锁则跳过执行
		if (locked) return;
		// 获取锁
		locked = true;

		try {
			// 执行函数
			fn(...args);
		} catch (err) {
			// 打印错误
			console.error("Execution error:", err);
			// 重新抛出错误
			throw err;
		} finally {
			// 无论成功失败都释放锁
			locked = false;
		}
	};
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	retries = 3,
	delay = 1000
): Promise<T> {
	let lastError: Error

	for (let i = 0; i < retries; i++) {
		try {
			return await fn()
		} catch (e) {
			lastError = e
			if (i < retries - 1) {
				await new Promise(resolve => setTimeout(resolve, delay))
			}
		}
	}

	throw lastError
}

export async function withLock<T>(
	ctx: Context,
	key: string,
	fn: () => Promise<T>
): Promise<T> {
	const lock = await ctx.database.get('locks', { key })
	if (lock && lock.length > 0) {
		throw new Error('操作正在执行中，请稍后再试')
	}

	try {
		await ctx.database.create('locks', { key })
		return await fn()
	} finally {
		await ctx.database.remove('locks', { key })
	}
}

export function formatDate(date: Date): string {
	return date.toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	})
}

export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

export function chunkArray<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = []
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size))
	}
	return chunks
}

export function isValidUrl(url: string): boolean {
	try {
		new URL(url)
		return true
	} catch {
		return false
	}
}

export function sanitizeString(str: string): string {
	return str.replace(/[<>]/g, '')
}

export function generateRandomString(length: number): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	let result = ''
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length))
	}
	return result
}
