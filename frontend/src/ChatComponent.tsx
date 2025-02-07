import React, {useEffect, useRef, useState} from "react";
import {Light as SyntaxHighlighter} from "react-syntax-highlighter";
import {materialDark} from "react-syntax-highlighter/dist/esm/styles/prism";
import Linkify from "linkify-react";

type ChatComponentProps = {
	sections: Array<string>;
};

type NewMessage = {
	type: "text" | "code";
	content: string;
	language?: string;
};

const ChatComponent = ({sections}: ChatComponentProps) => {
	const responseRef = useRef<HTMLDivElement | null>(null);
	const [processedMessages, setProcessedMessages] = useState<Array<NewMessage>>([]);

	useEffect(() => {
		let newMessages: Array<NewMessage> = [];

		sections.forEach((message) => {
			const regex = /```(\w+)?\n([\s\S]+?)\n```/g;
			let match;
			let lastIndex = 0;

			while ((match = regex.exec(message)) !== null) {
				// Push text before the code block
				if (match.index > lastIndex) {
					newMessages.push({type: "text", content: message.substring(lastIndex, match.index)});
				}

				// Extract language and code content
				const language = match[1] || "javascript";
				const codeContent = match[2];

				newMessages.push({type: "code", content: codeContent, language});
				lastIndex = regex.lastIndex;
			}

			// Push any remaining text after the last code block
			if (lastIndex < message.length) {
				newMessages.push({type: "text", content: message.substring(lastIndex)});
			}
		});

		setProcessedMessages(newMessages);
	}, [sections]);

	useEffect(() => {
		const chatContainer = responseRef?.current;
		if (!chatContainer) return;

		const isAtBottom =
			chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 40;

		if (isAtBottom) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}, [sections]);

	useEffect(() => {
		responseRef.current?.scrollTo({top: responseRef.current.scrollHeight, behavior: "smooth"});
	}, [processedMessages]);

	if (processedMessages.length === 0) {
		return <></>;
	}

	return (
		<div
			ref={responseRef}
			className="mt-5 flex flex-col text-white whitespace-pre-line border border-gray-300 p-3 rounded-md bg-gradient-to-bl bg-gray-500 h-96 overflow-y-auto break-words"
		>
			{processedMessages.map((message, i) => {
				if (message.type === "code") {
					return (
						<SyntaxHighlighter
							language={message.language}
							style={materialDark}
							key={i}
							className=""
							showLineNumbers={true}
							wrapLongLines={true}
						>
							{message.content}
						</SyntaxHighlighter>
					);
				}
				return (
					<Linkify
						as={"p"}
						key={i}
						className={`p-3 rounded-2xl mt-5 w-fit text-left ${
							i % 2 === 0 ? "bg-blue-500 self-end" : "bg-gray-500"
						}`}
						options={{target: "_blank"}}
					>
						{message.content}
					</Linkify>
				);
			})}
		</div>
	);
};

export default ChatComponent;
