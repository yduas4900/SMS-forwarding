// API 配置 - 自动适配开发和生产环境
const API_BASE_URL = process.env.REACT_APP_API_URL || window.location.origin;

export default API_BASE_URL;
