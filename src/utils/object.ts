export const pick = <T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>;

  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });

  return result;
}

export const omit = <T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const result = { ...obj } as T;

  keys.forEach((key) => {
    delete result[key];
  });

  return result;
}

export const isObjectEmpty = (obj: Record<string, unknown>): boolean => {
  return Object.keys(obj).length === 0;
}

export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
}

export const mergeObjects = <T extends Record<string, unknown>, U extends Record<string, unknown>>(obj1: T, obj2: U): T & U => {
  return { ...obj1, ...obj2 };
}
