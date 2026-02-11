declare module "encoding-japanese" {
  type ConvertOptions = {
    from: string;
    to: string;
    type?: "array" | "string";
  };

  const Encoding: {
    stringToCode: (value: string) => number[];
    convert: (
      data: number[] | Uint8Array,
      options: ConvertOptions,
    ) => number[] | Uint8Array;
  };

  export default Encoding;
}
