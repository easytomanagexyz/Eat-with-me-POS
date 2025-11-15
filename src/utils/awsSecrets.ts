import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
const ssm = new SSMClient({ region: "ap-south-1" });

export async function getParameter(name: string) {
  const cmd = new GetParameterCommand({ Name: name, WithDecryption: true });
  const res = await ssm.send(cmd);
  if (!res.Parameter || res.Parameter.Value === undefined) {
    throw new Error(`Parameter '${name}' not found or has no value.`);
  }
  return res.Parameter.Value;
}
// OPTIONAL: preload multiple secrets for efficiency
export async function preloadSecrets(names: string[]) {
  const result: Record<string, string> = {};
  for (const name of names) {
    result[name] = await getParameter(name);
  }
  return result;
}
