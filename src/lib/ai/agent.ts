import Anthropic from "@anthropic-ai/sdk";
import { ProcessMessageParams, AgentResponse, ReservationInfo } from "./types";
import { loadRestaurantContext } from "./context";
import { buildSystemPrompt } from "./system-prompt";
import { toolDefinitions, toolHandlers } from "./tools";
import { getSession, appendMessages } from "./session-store";

const anthropic = new Anthropic();

const MAX_TOOL_ROUNDS = 5;

export async function processMessage(
  params: ProcessMessageParams
): Promise<AgentResponse> {
  const { restaurantId, sessionId, message, locale, source } = params;

  // Load restaurant context
  const restaurant = await loadRestaurantContext(restaurantId);
  if (!restaurant) {
    return {
      reply:
        locale === "de"
          ? "Entschuldigung, das Restaurant wurde nicht gefunden."
          : "Sorry, the restaurant was not found.",
    };
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt({ restaurant, locale, source });

  // Get conversation history
  const history = getSession(sessionId);

  // Build messages array for Claude
  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: message },
  ];

  let reservation: ReservationInfo | undefined;

  // Tool-use loop
  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: systemPrompt,
    tools: toolDefinitions,
    messages,
  });

  let rounds = 0;
  while (response.stop_reason === "tool_use" && rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    // Collect all tool calls from the response
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === "tool_use"
    );

    // Execute each tool and collect results
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const toolBlock of toolUseBlocks) {
      const handler = toolHandlers[toolBlock.name];
      if (!handler) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: JSON.stringify({ error: `Unknown tool: ${toolBlock.name}` }),
        });
        continue;
      }

      const result = await handler(
        toolBlock.input as Record<string, unknown>,
        { restaurantId, locale }
      );

      // Check if a reservation was created
      const resultObj = result as Record<string, unknown>;
      if (
        toolBlock.name === "create_reservation" &&
        resultObj.success &&
        resultObj.reservation
      ) {
        reservation = resultObj.reservation as ReservationInfo;
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: JSON.stringify(result),
      });
    }

    // Continue conversation with tool results
    messages.push(
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults }
    );

    response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      tools: toolDefinitions,
      messages,
    });
  }

  // Extract text from final response
  const textBlocks = response.content.filter(
    (block): block is Anthropic.Messages.TextBlock => block.type === "text"
  );
  const reply = textBlocks.map((b) => b.text).join("\n") ||
    (locale === "de"
      ? "Entschuldigung, ich konnte keine Antwort generieren."
      : "Sorry, I couldn't generate a response.");

  // Save to session history
  appendMessages(sessionId, message, reply);

  return { reply, reservation };
}
