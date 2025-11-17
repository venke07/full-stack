
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
