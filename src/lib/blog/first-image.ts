const seen = new WeakSet<Request>();

export const firstImage = (request: Request): boolean => {
  const first = !seen.has(request);
  seen.add(request);
  return first;
};
