// services/authService.js
export const authenticateUser = async (userData) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/oauth-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error('Error al autenticar usuario');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en la API:', error);
    throw error;
  }
};
