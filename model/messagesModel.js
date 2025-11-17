import supabase from "../config/supabaseClient.js";

export async function getConversationMessages(conversationId) {
    const { data, error } = await supabase
        .from("messages")
        .select(`
            id,
            sender,
            content,
            date_created,
            last_accessed,
            conversations (
                id,
                title,
                agent_id,
                date_created
            )
        `)
        .eq("conversation_id", conversationId)
        .order("date_created", { ascending: true });

    if (error) throw new Error(error.message);
    return data;
}
