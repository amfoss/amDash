{
  description = "Python + pip dev shell (system nixpkgs)";

  inputs = {
    nixos-config.url = "path:/home/hridesh/nix-config";
    nixpkgs.follows = "nixos-config/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs
            pkgs.python312
            pkgs.python312Packages.pip
          ];

        };

        shellHook = ''
          if [ ! -d .venv ]; then
            python3 -m venv .venv
          fi
          source .venv/bin/activate.csh
          echo "Python $(python3 --version) ready. venv active, pip installed."
        '';

      }
    );
}
