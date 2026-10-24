interface ConnectionHint {
  saveData?: boolean;
}

export const prefersLightLoad = (): boolean => {
  const { connection } = navigator as Navigator & {
    connection?: ConnectionHint;
  };
  return connection?.saveData === true;
};
