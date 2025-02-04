import {useCallback, useEffect, useRef, useState} from "react";
import {clearHistory, getMessagesByConversation, Message, saveMessage} from "./idb";

const API_URL = "https://javabudd.hopto.org/query";
const DEFAULT_MODEL = "llama3.2";
const DEFAULT_SEARCH_ENGINE = "duckduckgo";

const QueryLlmComponent: React.FC = () => {
	const [message, setMessage] = useState("");
	const [model, setModel] = useState<string>(DEFAULT_MODEL);
	const [systemContent, setSystemContent] = useState<string | undefined>(undefined);
	const [searchEngine, setSearchEngine] = useState<string>(DEFAULT_SEARCH_ENGINE);
	const [response, setResponse] = useState("");
	const [sections, setSections] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [history, setHistory] = useState<Array<Message>>([]);
	const [error, setError] = useState<string | null>(null);
	const controllerRef = useRef<AbortController | null>(null);
	const responseRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		getMessagesByConversation("123").then((history) => {
			setHistory(history);
			for (const item of history) {
				setSections((state) => [...state, item.content.trim()]);
			}
		});
	}, []);

	const sendRequest = useCallback(async () => {
		if (!message.trim()) return;

		setLoading(true);
		setError(null);
		setSections((state) => [...state, message.trim()]);
		setResponse("");
		setMessage("");

		if (controllerRef.current) {
			controllerRef.current.abort();
		}

		const controller = new AbortController();
		controllerRef.current = controller;
		const signal = controller.signal;

		const newMessage = {role: "user", content: message, conversation_id: "123"};

		try {
			const res = await fetch(API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model,
					message,
					searchEngine,
					history: [...history],
					systemContent
				}),
				signal,
			});

			if (!res.ok || !res.body) {
				throw new Error(`Server error: ${res.statusText}`);
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let result = "";

			while (true) {
				const {done, value} = await reader.read();
				if (done) break;
				result += decoder.decode(value, {stream: true});
				setResponse(result);
			}

			const assistantResponse = {role: "assistant", content: result, conversation_id: "123"};

			await saveMessage(newMessage);
			await saveMessage(assistantResponse);
			setHistory(prev => [...prev, newMessage, assistantResponse]);
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
				setError((err as Error).message);
			}
		} finally {
			setLoading(false);
		}
	}, [model, message, searchEngine, history, systemContent]);


	const stopRequest = () => {
		if (controllerRef.current) {
			controllerRef.current.abort();
			controllerRef.current = null;
		}
		setLoading(false);
		setError("Request was cancelled.");
	};

	const resetForm = async () => {
		setMessage("");
		setResponse("");
		setSections([])
		setError(null);
		setModel(DEFAULT_MODEL);
		setSearchEngine(DEFAULT_SEARCH_ENGINE);
		setHistory([]);
		setSystemContent(undefined);
		await clearHistory();
	};

	useEffect(() => {
		const chatContainer = responseRef?.current;

		if (!chatContainer) return;

		const isAtBottom =
			chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 40;

		if (isAtBottom) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}

	}, [response]);

	useEffect(() => {
		if (!response) return;

		setSections((state) => {
			const newState = [...state]
			const lastResponse = state[state.length - 1]
			if (response.includes(lastResponse)) {
				newState[state.length - 1] = response
			} else {
				newState.push(response)
			}
			return newState
		})

	}, [response]);

	return (
		<div className="p-5 font-sans text-center mx-auto">
			<h2 className="text-xl font-bold">How can we help?</h2>
			<div ref={responseRef}
			     className="mt-5 flex flex-col text-white whitespace-pre-line border border-gray-300 p-3 rounded-md bg-gradient-to-bl bg-white h-96 overflow-y-auto break-words">
				{sections.map((message, i) => <p key={i}
				                                 className={`p-3 rounded-2xl mt-5 w-fit text-left ${i % 2 === 0 ? 'bg-blue-500 self-end' : 'bg-gray-500'}`}>{message}</p>)}
			</div>

			{error && <p className="mt-5 text-red-500">Error: {error}</p>}
			<textarea placeholder="Enter your query" value={message} onChange={(e) => setMessage(e.target.value)}
			          disabled={loading} className="p-2 mt-4 w-full max-w-md border rounded-md"/>

			<div className="mt-4 flex flex-wrap justify-center gap-3">
				{loading ? (
					<button onClick={stopRequest} className="p-2 bg-red-500 text-white rounded-md">Cancel</button>
				) : (
					<button onClick={sendRequest} disabled={loading}
					        className="p-2 bg-blue-500 text-white rounded-md">Send</button>
				)}
				<button onClick={resetForm} className="p-2 bg-gray-500 text-white rounded-md">Reset</button>
				<select onChange={(e) => setModel(e.target.value)} value={model} className="p-2 border rounded-md">
					<option value="llama3.2">Llama 3.2 (3B)</option>
					<option value="phi4">phi4 (14B)</option>
					<option value="deepseek-r1">DeepSeek-R1 (7B)</option>
					<option disabled={true} value="">---- Premium ----</option>
					<option disabled={true} value="deepseek-r1-70b">DeepSeek-R1 (70B)</option>
					<option disabled={true} value="llama3.3">Llama 3.3 (70B)</option>
				</select>
				{/*<select disabled value={searchEngine} className="p-2 border rounded-md">*/}
				{/*	<option value="duckduckgo">DuckDuckGo</option>*/}
				{/*</select>*/}
			</div>
		</div>
	);
};

export default QueryLlmComponent;
