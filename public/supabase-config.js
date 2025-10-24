// Supabase Configuration
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// Your Supabase credentials
const supabaseUrl = 'https://czqywmnordnnnvopeszm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cXl3bW5vcmRubm52b3Blc3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMTU2MDMsImV4cCI6MjA3Njg5MTYwM30.MPWgqvZqONEnY299YA3R0Wn8N3uFd9WaOEG5ZaQtJH4';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Neural User Profile Management
export class NeuralUserManager {
  constructor() {
    this.supabase = supabase;
  }

  // Create neural profile (signup)
  async createNeuralProfile(name, email, password) {
    try {
      // First, create the auth user
      const { data: authData, error: authError } = await this.supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            display_name: name,
            neural_id: email,
          }
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      // Create profile in custom table
      if (authData.user) {
        const { data: profileData, error: profileError } = await this.supabase
          .from('neural_profiles')
          .insert([
            {
              id: authData.user.id,
              name: name,
              email: email,
              neural_id: email,
              status: 'active',
              created_at: new Date().toISOString(),
              last_login: new Date().toISOString()
            }
          ]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Continue anyway, auth user was created
        }
      }

      return {
        success: true,
        user: authData.user,
        message: `Neural profile initialized for ${name}`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Neural authentication (login)
  async authenticateNeural(email, password) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        throw new Error(error.message);
      }

      // Update last login
      await this.supabase
        .from('neural_profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);

      return {
        success: true,
        user: data.user,
        session: data.session,
        message: `Neural link established for ${data.user.user_metadata?.display_name || 'Agent'}`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get current neural session
  async getCurrentSession() {
    const { data: { session }, error } = await this.supabase.auth.getSession();
    return { session, error };
  }

  // Disconnect neural link (logout)
  async disconnectNeural() {
    const { error } = await this.supabase.auth.signOut();
    return { success: !error, error };
  }

  // Get neural profile data
  async getNeuralProfile(userId) {
    try {
      const { data, error } = await this.supabase
        .from('neural_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return { success: true, profile: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Update neural activity
  async logNeuralActivity(userId, activity) {
    try {
      await this.supabase
        .from('neural_activities')
        .insert([
          {
            user_id: userId,
            activity: activity,
            timestamp: new Date().toISOString()
          }
        ]);
    } catch (error) {
      console.error('Activity logging error:', error);
    }
  }

  // Get recent neural activities
  async getNeuralActivities(userId, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('neural_activities')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, activities: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const neuralManager = new NeuralUserManager();
