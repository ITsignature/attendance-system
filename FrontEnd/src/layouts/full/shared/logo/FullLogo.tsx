  import React, { useState, useEffect } from "react";
  import Logo from "/src/assets/images/logos/logo.svg";
  import { Link } from "react-router";
  import settingsApi from "../../../../services/settingsApi";

  const getCachedLogo = (): string => {
    try {
      const userData = localStorage.getItem('user');
      const clientId = userData ? JSON.parse(userData)?.clientId : null;
      return (
        (clientId ? localStorage.getItem(`cached_company_logo_${clientId}`) : null) ||
        localStorage.getItem('cached_company_logo') ||
        ''
      );
    } catch {
      return localStorage.getItem('cached_company_logo') || '';
    }
  };

  const getClientId = (): string => {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData)?.clientId || '' : '';
    } catch {
      return '';
    }
  };

  const FullLogo = () => {
    const [logoSrc, setLogoSrc] = useState<string>(getCachedLogo);

    useEffect(() => {
      let isMounted = true;

      const fetchLogo = async () => {
        try {
          const token = localStorage.getItem('accessToken');
          if (!token) return;

          const info = await settingsApi.getCompanyInfo();
          if (!isMounted) return;

          const clientId = getClientId();
          const logo = info?.company_logo || '';

          setLogoSrc(logo);
          if (logo) {
            localStorage.setItem('cached_company_logo', logo);
            if (clientId) {
              localStorage.setItem(`cached_company_logo_${clientId}`, logo);
            }
          } else {
            localStorage.removeItem('cached_company_logo');
            if (clientId) {
              localStorage.removeItem(`cached_company_logo_${clientId}`);
            }
          }
        } catch (err) {
          console.warn('Failed to load company logo for sidebar:', err);
        }
      };

      fetchLogo();

      const handleLogoUpdate = (e: any) => {
        const clientId = getClientId();
        const updatedLogo =
          e?.detail !== undefined
            ? e.detail
            : (clientId ? localStorage.getItem(`cached_company_logo_${clientId}`) : null) ||
              localStorage.getItem('cached_company_logo') ||
              '';

        if (typeof updatedLogo === 'string') {
          setLogoSrc(updatedLogo);
          if (updatedLogo) {
            localStorage.setItem('cached_company_logo', updatedLogo);
            if (clientId) {
              localStorage.setItem(`cached_company_logo_${clientId}`, updatedLogo);
            }
          } else {
            localStorage.removeItem('cached_company_logo');
            if (clientId) {
              localStorage.removeItem(`cached_company_logo_${clientId}`);
            }
          }
        }
      };

      window.addEventListener('company_logo_updated', handleLogoUpdate);
      window.addEventListener('storage', handleLogoUpdate);

      return () => {
        isMounted = false;
        window.removeEventListener('company_logo_updated', handleLogoUpdate);
        window.removeEventListener('storage', handleLogoUpdate);
      };
    }, []);

    return (
      <Link to={"/"} className="flex items-center">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt="Company Logo"
            className="block max-h-12 max-w-[190px] w-auto h-auto object-contain"
            onError={() => setLogoSrc('')}
          />
        ) : (
          <img
            src={Logo}
            alt="IT Signature"
            className="block max-h-12 max-w-[190px] w-auto h-auto object-contain"
          />
        )}
      </Link>
    );
  };

  export default FullLogo;
