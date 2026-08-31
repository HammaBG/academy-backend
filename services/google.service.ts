import { OAuth2Client } from "google-auth-library";

const getGoogleClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  return new OAuth2Client(clientId);
};

export interface GoogleUserPayload {
  email: string;
  email_verified?: boolean;
  first_name: string;
  last_name: string;
  picture?: string;
}

export const verifyGoogleToken = async (idToken: string): Promise<GoogleUserPayload> => {
  const client = getGoogleClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  
  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error("Invalid Google token payload");
  }

  const { email, email_verified, given_name, family_name, picture } = payload;
  if (!email) {
    throw new Error("Google account is missing an email address");
  }

  return {
    email: email.toLowerCase(),
    email_verified,
    first_name: given_name || "Google",
    last_name: family_name || "User",
    picture,
  };
};
