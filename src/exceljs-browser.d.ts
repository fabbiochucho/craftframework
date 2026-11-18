// The browser build of exceljs (loaded on demand by the offline workbook) has the same API as the package.
declare module 'exceljs/dist/exceljs.min.js' {
  import ExcelJS from 'exceljs'
  export default ExcelJS
}
