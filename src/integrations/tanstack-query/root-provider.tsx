import { QueryClient } from "@tanstack/react-query";

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				networkMode: "offlineFirst",
			},
			mutations: {
				networkMode: "offlineFirst",
			},
		},
	});

	return {
		queryClient,
	};
}
export default function TanstackQueryProvider() {}
