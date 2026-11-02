import IORedis from "ioredis";
import { config } from "./config";

// BullMQ requires maxRetriesPerRequest = null
export const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
