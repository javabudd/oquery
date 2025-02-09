import React, {SetStateAction, useEffect} from "react";
import {getMessagesByConversation, Message} from "./idb";
import ChatComponent from "./ChatComponent";

export type QueryLlmComponentProps = {
	response: string;
	error: string | null;
	setHistory: React.Dispatch<SetStateAction<Array<Message>>>;
	sections: Array<string>;
	setSections: React.Dispatch<SetStateAction<Array<string>>>;
}

const QueryLlmComponent: React.FC<QueryLlmComponentProps> = (
	{
		response,
		error,
		setHistory,
		sections,
		setSections
	}
) => {
	useEffect(() => {
		getMessagesByConversation("123").then((history) => {
			setHistory(history);
			for (const item of history) {
				setSections((state) => [...state, item.content.trim()]);
			}
		});
	}, [setHistory, setSections]);

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

	}, [response, setSections]);

	return (
		<div className="p-5 font-sans text-center mx-auto">
			<h2 className="text-xl font-bold">How can we help?</h2>
			<ChatComponent sections={sections}/>
			{error && <p className="mt-5 text-red-500">Error: {error}</p>}
		</div>
	);
};

export default QueryLlmComponent;
