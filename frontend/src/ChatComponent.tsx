import React, {useEffect, useRef, useState} from "react";
import {Light as SyntaxHighlighter} from "react-syntax-highlighter";
import {materialDark} from "react-syntax-highlighter/dist/esm/styles/prism";
import Linkify from "linkify-react";

type ChatComponentProps = {
	sections: Array<string>;
}

type NewMessage = {
	type: "text" | "code";
	content: string;
}

const ChatComponent = ({sections}: ChatComponentProps) => {
	const responseRef = useRef<HTMLDivElement | null>(null);
	const [buffer, setBuffer] = useState("");
	const [processedMessages, setProcessedMessages] = useState<Array<NewMessage>>([]);

	useEffect(() => {
		let newMessages: Array<NewMessage> = [];
		let tempBuffer = buffer;

		sections.forEach((message) => {
			if (message.startsWith("```") && message.endsWith("```")) {
				newMessages.push({type: "code", content: extractCode(message)});
				tempBuffer = "";
			} else if (message.startsWith("```")) {
				tempBuffer = message;
			} else if (message.endsWith("```") && tempBuffer) {
				newMessages.push({type: "code", content: extractCode(tempBuffer + "\n" + message)});
				tempBuffer = "";
			} else if (tempBuffer) {
				tempBuffer += "\n" + message;
			} else {
				newMessages.push({type: "text", content: message});
			}
		});

		setBuffer(tempBuffer);
		setProcessedMessages(newMessages);
	}, [sections, buffer]);

	useEffect(() => {
		const chatContainer = responseRef?.current;

		if (!chatContainer) return;

		const isAtBottom =
			chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 40;

		if (isAtBottom) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}

	}, [sections]);

	if (processedMessages.length === 0) {
		return (<></>);
	}

	return (
		<div ref={responseRef}
		     className="mt-5 flex flex-col text-white whitespace-pre-line border border-gray-300 p-3 rounded-md bg-gradient-to-bl bg-white h-96 overflow-y-auto break-words">
			{processedMessages.map((message, i) => {
				if (message.type === "code") {
					return (
						<SyntaxHighlighter
							language="javascript"
							style={materialDark}
							key={i}
							className="p-3 rounded-2xl mt-5 w-fit text-left bg-gray-700"
						>
							{message.content}
						</SyntaxHighlighter>
					);
				}
				return (
					<Linkify
						as={"p"}
						key={i}
						className={`p-3 rounded-2xl mt-5 w-fit text-left ${i % 2 === 0 ? 'bg-blue-500 self-end' : 'bg-gray-500'}`}
						options={{target: '_blank'}}
					>
						{message.content}
					</Linkify>
				);
			})}
		</div>
	);
};

const extractCode = (message: string) => {
	return message.replace(/```[a-z]*\n/, "").replace(/```$/, "");
};

export default ChatComponent;
