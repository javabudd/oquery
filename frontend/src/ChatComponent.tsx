import React, {useEffect, useRef, useState} from "react";
import {Light as SyntaxHighlighter} from "react-syntax-highlighter";
import {a11yDark} from "react-syntax-highlighter/dist/esm/styles/prism";
import Linkify from "linkify-react";
import CopyToClipboard from 'react-copy-to-clipboard';

type ChatComponentProps = {
	sections: Array<string>;
};

type NewMessage = {
	type: "text" | "code";
	content: string;
	language?: string;
};

const ChatComponent: React.FC<ChatComponentProps> = (
	{
		sections
	}
) => {
	const responseRef = useRef<HTMLDivElement | null>(null);
	const [processedMessages, setProcessedMessages] = useState<Array<NewMessage>>([]);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const prevScrollTop = useRef(0);

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

	const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
		const target = event.currentTarget;
		const isScrollingUp = target.scrollTop < prevScrollTop.current;
		prevScrollTop.current = target.scrollTop;

		setIsAtBottom(!isScrollingUp && target.scrollHeight - target.scrollTop >= target.clientHeight);
	};

	useEffect(() => {
		const chatContainer = responseRef.current;
		if (!chatContainer || !isAtBottom) return;

		// Force scrolling to bottom when new messages arrive
		requestAnimationFrame(() => {
			chatContainer.scrollTo({top: chatContainer.scrollHeight, behavior: "smooth"});
		});
	}, [processedMessages, isAtBottom]);

	if (processedMessages.length === 0) {
		return <></>;
	}

	return (
		<div
			ref={responseRef}
			className="mt-5 mx-auto flex max-h-96 flex-col max-w-screen-md text-white whitespace-pre-line border border-gray-300 p-3 rounded-md bg-gradient-to-bl bg-gray-500 overflow-y-auto break-words"
			onScroll={handleScroll}
		>
			{processedMessages.map((message, i) => {
				if (message.type === "code") {
					return (
						<div key={i}>
							<div className="flex flex-row items-center mb-4">
								<SyntaxHighlighter
									language={message.language}
									style={a11yDark}
									showLineNumbers={true}
									wrapLongLines={true}
									className="max-h-50 rounded-sm"
								>
									{message.content}
								</SyntaxHighlighter>
							</div>
							<CopyToClipboard text={message.content}>
								<button className="ml-4 p-2 bg-gray-600 rounded-sm hover:bg-gray-700">
									Copy
								</button>
							</CopyToClipboard>
						</div>
					);
				}
				return (
					<Linkify
						as={"p"}
						key={i}
						className={`p-3 rounded-2xl mt-5 w-fit text-left ${
							i % 2 === 0 ? "bg-blue-500 self-end max-w-sm" : "bg-gray-500"
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
