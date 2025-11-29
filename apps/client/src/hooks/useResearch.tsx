import { useState } from "react";
import { API } from "../utils/constants";

export function useResearch() {
	const [results, setResults] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string>("");

	const research = async (query: string) => {
		setIsLoading(true);
		setError("");
		try {
			const res = await fetch(
				API.ENDPOINTS.CAPABILITIES.BASE_URL() + "/research",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				}
			);
			if (!res.ok) throw new Error("Failed to fetch research results");
			const data = await res.json();
			setResults(data);
		} catch (err: any) {
			setError(err.message || "Unknown error");
			setResults([]);
		} finally {
			setIsLoading(false);
		}
	};

	return { research, results, isLoading, error };
}
