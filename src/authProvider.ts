import { AuthProvider } from "@pankod/refine";
import { dataProvider, client } from "dataProvider";

export const TOKEN_KEY = "orderdulu-seller-auth";

export const authProvider: AuthProvider = {
    login: async ({ username, password }) => {        
        try {
            const { data } = await dataProvider.custom!({
                url: "",
                method: "post",
                metaData: {
                    operation: "login",
                    variables: {
                        input: {
                        value: { identifier: username, password },
                        type: "UsersPermissionsLoginInput",
                        required: true,
                    },
                  },
                  fields: ["jwt", "user {id, role {id, name}, username, email}"],
                },
            });

            localStorage.setItem(TOKEN_KEY, `${data.jwt}`);
            client.setHeader("Authorization", `Bearer ${data.jwt}`);

            await authProvider.getPermissions();

            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    },
    logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        client.setHeader("Authorization", ``);
        return Promise.resolve();
    },
    checkError: () => Promise.resolve(),
    checkAuth: () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
            return Promise.resolve();
        }

        client.setHeader("Authorization", `Bearer ${token}`);

        return Promise.reject();
    },
    getPermissions: async () => {
        try {
            const token = localStorage.getItem(TOKEN_KEY);
            if (!token) {
                throw new Error("Anda tidak berhak untuk masuk ke dalam aplikasi");
            }

            client.setHeader("Authorization", `Bearer ${token}`);

            const { data } = await dataProvider.custom!({
                url: "",
                method: "get",
                metaData: {
                    operation: "me",
                    fields: [
                        {
                            role: ["name"],
                        },
                    ],
                },
            });
            const { role } = data;

            if ((role.name + '').toUpperCase() !== "SELLER" && (role.name + '').toUpperCase() !== "INTERNAL") {
                throw new Error("Anda tidak berhak untuk masuk ke dalam aplikasi");
            }

            return Promise.resolve(role);
        } catch (error) {
            await authProvider.logout("/");

            return Promise.reject(error);
        }
    },
    getUserIdentity: async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
            return Promise.reject();
        }

        console.log('getUserIdentity', token);
        client.setHeader("Authorization", `Bearer ${token}`);

        try {
            const { data } = await dataProvider.custom!({
                url: "",
                method: "get",
                metaData: {
                    operation: "me",
                    fields: ["id", "username", "email"],
                },
            });

            const { id, username, email } = data;
            return Promise.resolve({
                id,
                username,
                email,
            });
        } catch (error) {
            return Promise.reject(error);
        }
    },
};
