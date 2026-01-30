
// model/conversationModel.js
import supabase from '../config/supabaseClient.js';

export async function getAgentConversations(agentId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*') // pick the columns you need
    .eq('agent_id', agentId)
    .order('date_created', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}



export async function deleteConversationById(conversationId) {
  // Step 1 — Delete messages linked to this conversation
  const { error: msgError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);

  if (msgError) throw new Error(msgError.message);

  // Step 2 — Now delete the conversation
  const { error: convError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (convError) throw new Error(convError.message);

  return true;
}

export async function deleteAllConversations() {
  const { error: msgError } = await supabase
    .from('messages')
    .delete()
    .neq('id', 0); 

  if (msgError) throw new Error(msgError.message);

  const { error: convError } = await supabase
    .from('conversations')
    .delete()
    .neq('id', 0); 

  if (convError) throw new Error(convError.message);

  return true;
}