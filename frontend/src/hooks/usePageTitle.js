import { useEffect } from 'react';

/**
 * 设置页面标题的自定义Hook
 * @param {string} pageTitle - 页面功能名称
 * @param {string} siteName - 网站名称，默认为"协途"
 */
export const usePageTitle = (pageTitle, siteName = '协途') => {
  useEffect(() => {
    if (pageTitle) {
      document.title = `${siteName} - ${pageTitle}`;
    } else {
      document.title = siteName;
    }
    
    // 组件卸载时恢复默认标题
    return () => {
      document.title = siteName;
    };
  }, [pageTitle, siteName]);
};

export default usePageTitle;
