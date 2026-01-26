import supabase from '../config/supabaseClient.js';

// Get all agents
export async function getAgents() {
  const { data, error } = await supabase.from('agents').select('*');
  if (error) throw new Error(error.message);
  return data;
}

