import { useCallback, useEffect, useRef, useState } from "react";
import { type ApiError, toApiError } from "../services/apiClient";
import { ApiTaskCoordinator } from "./apiTaskCoordinator";

export type ApiTaskStatus = "idle" | "loading" | "success" | "error";

export interface ApiTask<T, TArgs extends unknown[]> {
  status: ApiTaskStatus;
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  canRetry: boolean;
  execute: (...args: TArgs) => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
}

export function useApiTask<T, TArgs extends unknown[]>(
  operation: (...args: TArgs) => Promise<T>,
  options: { retry?: "safe" } = {},
): ApiTask<T, TArgs> {
  const operationRef = useRef(operation);
  const coordinatorRef = useRef(new ApiTaskCoordinator<TArgs>());
  const [status, setStatus] = useState<ApiTaskStatus>("idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  operationRef.current = operation;

  useEffect(() => {
    coordinatorRef.current.activate();

    return () => coordinatorRef.current.dispose();
  }, []);

  const execute = useCallback(async (...args: TArgs): Promise<T | null> => {
    const sequence = coordinatorRef.current.begin(args, options.retry === "safe");
    setStatus("loading");
    setError(null);

    try {
      const result = await operationRef.current(...args);
      if (coordinatorRef.current.accepts(sequence)) {
        setData(result);
        setStatus("success");
      }

      return result;
    } catch (cause) {
      if (coordinatorRef.current.accepts(sequence)) {
        setError(toApiError(cause));
        setStatus("error");
      }

      return null;
    }
  }, [options.retry]);

  const retry = useCallback((): Promise<T | null> => {
    const retryArguments = coordinatorRef.current.retryArgs();
    if (options.retry !== "safe" || !retryArguments) return Promise.resolve(null);

    return execute(...retryArguments);
  }, [execute, options.retry]);

  const reset = useCallback(() => {
    coordinatorRef.current.reset();
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  return {
    status,
    data,
    error,
    loading: status === "loading",
    canRetry: options.retry === "safe" && status === "error" && coordinatorRef.current.hasRetry(),
    execute,
    retry,
    reset,
  };
}
